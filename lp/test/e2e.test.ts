import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SpaceCoin, SpaceCoinIco, SpaceRouter, LiquidityPool } from "../typechain-types";
import {
  sqrt,
  ONE_ETHER,
  E2E_BASE_ETH_LIQUIDITY,
  E2E_BASE_SPC_LIQUIDITY,
  CLOSE_TO_TOLERANCE,
  apply05percentSlippage,
} from "./helpers/helpers";

enum IcoPhase {
  SEED,
  GENERAL,
  OPEN,
}

const applySpcTax = (amount: BigNumber): BigNumber => amount.mul(200).div(10_000);

describe("e2e ICO to LP", () => {
  async function setupFixture() {
    const signers = await ethers.getSigners();
    const [deployer, treasury, alice]: SignerWithAddress[] = signers;

    // use from third address to exclude deployer and treasury till the second last (last one will be non whitelisted)
    const whitelistedAddresses = signers.splice(4, signers.length - 2);

    const SpaceCoin = await ethers.getContractFactory("SpaceCoin");
    const spaceCoin: SpaceCoin = (await SpaceCoin.deploy(treasury.address)) as SpaceCoin;
    await spaceCoin.deployed();

    const SpaceCoinIco = await ethers.getContractFactory("SpaceCoinIco");
    const spaceCoinIco: SpaceCoinIco = (await SpaceCoinIco.deploy(spaceCoin.address, treasury.address, [
      alice.address,
      ...whitelistedAddresses.map((wa: SignerWithAddress) => wa.address),
    ])) as SpaceCoinIco;
    await spaceCoinIco.deployed();

    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool: LiquidityPool = (await LiquidityPool.deploy(spaceCoin.address)) as LiquidityPool;
    await liquidityPool.deployed();

    await spaceCoin.transfer(spaceCoinIco.address, spaceCoin.balanceOf(deployer.address));

    const SpaceRouter = await ethers.getContractFactory("SpaceRouter");
    const spaceRouter: SpaceRouter = (await SpaceRouter.deploy(
      liquidityPool.address,
      spaceCoin.address
    )) as SpaceRouter;
    await spaceRouter.deployed();

    return {
      alice,
      treasury,
      spaceCoin,
      liquidityPool,
      spaceCoinIco,
      spaceRouter,
      deployer,
      whitelistedAddresses,
    };
  }

  const icoFundingPhase = async (
    spaceCoin: SpaceCoin,
    spaceCoinIco: SpaceCoinIco,
    alice: SignerWithAddress,
    whitelistedAddresses: SignerWithAddress[],
    treasury: SignerWithAddress
  ) => {
    let currentContribution = ethers.utils.parseEther("0");
    for (let i = 0; i < 10; i++) {
      const value = ONE_ETHER.mul(1000);
      const investor = whitelistedAddresses[i];
      await spaceCoinIco.connect(investor).contribute({ value });
      currentContribution = currentContribution.add(value);
      expect(await spaceCoinIco.amountRaised()).to.be.equal(currentContribution);
    }

    expect(await spaceCoinIco.amountRaised()).to.be.equal(ONE_ETHER.mul(10_000));
    expect(await ethers.provider.getBalance(spaceCoinIco.address)).to.be.equal(ONE_ETHER.mul(10_000));

    await spaceCoinIco.phaseAdvance(IcoPhase.SEED);

    for (let i = 10; i < 20; i++) {
      const value = ONE_ETHER.mul(1000);
      const investor = whitelistedAddresses[i];
      await spaceCoinIco.connect(investor).contribute({ value });
      currentContribution = currentContribution.add(value);
      expect(await spaceCoinIco.amountRaised()).to.be.equal(currentContribution);
    }

    expect(await spaceCoinIco.amountRaised()).to.be.equal(ONE_ETHER.mul(20_000));
    expect(await ethers.provider.getBalance(spaceCoinIco.address)).to.be.equal(ONE_ETHER.mul(20_000));

    await spaceCoinIco.withdraw(ONE_ETHER.mul(10_000));

    // starting from 50k due to hardhat config
    expect(await treasury.getBalance()).to.be.equal(ONE_ETHER.mul(60_000));

    expect(await ethers.provider.getBalance(spaceCoinIco.address)).to.be.equal(ONE_ETHER.mul(10_000));
    expect(await spaceCoinIco.amountRaised()).to.be.equal(ONE_ETHER.mul(20_000));
    await expect(spaceCoinIco.connect(alice).withdraw(10_000))
      .to.be.revertedWithCustomError(spaceCoinIco, "MustBeOwner")
      .withArgs("NOT_OWNER");

    await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

    await spaceCoinIco.connect(alice).contribute({ value: ONE_ETHER.mul(10_000) });
    currentContribution = currentContribution.add(ONE_ETHER.mul(10_000));
    expect(await spaceCoinIco.amountRaised()).to.be.equal(currentContribution);

    expect(await spaceCoinIco.amountRaised()).to.be.equal(ONE_ETHER.mul(30_000));
    expect(await ethers.provider.getBalance(spaceCoinIco.address)).to.be.equal(ONE_ETHER.mul(20_000));
    await expect(spaceCoinIco.withdraw(0)).to.be.revertedWithCustomError(spaceCoinIco, "InsufficientAmount");
    await spaceCoinIco.withdraw(ONE_ETHER.mul(20_000));
    expect(await spaceCoinIco.amountRaised()).to.be.equal(ONE_ETHER.mul(30_000));

    expect(await spaceCoinIco.amountRaised()).to.be.equal(ONE_ETHER.mul(30_000));
    expect(await ethers.provider.getBalance(spaceCoinIco.address)).to.be.equal(ONE_ETHER.mul(0));

    await expect(spaceCoinIco.withdraw(20_000)).to.be.revertedWithCustomError(spaceCoinIco, "NotEnoughBalance");

    // starting from 50k due to hardhat config + 10k already withdrawed
    expect(await treasury.getBalance()).to.be.equal(ONE_ETHER.mul(80_000));
    expect(await spaceCoin.balanceOf(treasury.address)).to.be.equal(ONE_ETHER.mul(350_000));
  };

  const liquidityPoolTreasuryMint = async (
    liquidityPool: LiquidityPool,
    spaceRouter: SpaceRouter,
    spaceCoin: SpaceCoin,
    treasury: SignerWithAddress
  ) => {
    let [ethReserve, spcReserve] = await liquidityPool.getReserves();
    expect(ethReserve.isZero()).to.be.true;
    expect(spcReserve.isZero()).to.be.true;
    expect(ethReserve.mul(spcReserve).isZero()).to.be.true;

    await spaceCoin.connect(treasury).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
    await spaceRouter.connect(treasury).deposit(E2E_BASE_SPC_LIQUIDITY, { value: E2E_BASE_ETH_LIQUIDITY });

    [ethReserve, spcReserve] = await liquidityPool.getReserves();
    const expectedLP = sqrt(E2E_BASE_SPC_LIQUIDITY.mul(E2E_BASE_ETH_LIQUIDITY).toString());

    expect(ethReserve).to.be.equal(E2E_BASE_ETH_LIQUIDITY);
    expect(spcReserve).to.be.equal(E2E_BASE_SPC_LIQUIDITY);
    expect(ethReserve.mul(spcReserve)).to.be.equal(E2E_BASE_ETH_LIQUIDITY.mul(E2E_BASE_SPC_LIQUIDITY));

    [ethReserve, spcReserve] = await liquidityPool.getReserves();

    expect(await ethers.provider.getBalance(treasury.address)).to.be.closeTo(
      ethers.utils.parseEther("50000"),
      CLOSE_TO_TOLERANCE
    );

    // 350_000 - 150_000 = 200_000
    expect(await spaceCoin.balanceOf(treasury.address)).to.be.equal(ethers.utils.parseEther("200000"));
    expect(await liquidityPool.balanceOf(treasury.address)).to.be.equal(expectedLP.toBigInt());
    expect(ethReserve).to.be.equal(E2E_BASE_ETH_LIQUIDITY);
    expect(spcReserve).to.be.equal(E2E_BASE_SPC_LIQUIDITY);
  };

  describe("Deployment", () => {
    it("Contract it's deployed", async () => {
      const { spaceCoin, spaceCoinIco, spaceRouter, liquidityPool } = await loadFixture(setupFixture);
      expect(spaceCoin.address).not.be.null;
      expect(spaceCoinIco.address).not.be.null;
      expect(spaceRouter.address).not.be.null;
      expect(liquidityPool.address).not.be.null;
    });
  });

  describe("Funding ICO and add LP reserves", () => {
    it("Base scenario", async () => {
      const { spaceCoin, spaceCoinIco, spaceRouter, liquidityPool, alice, whitelistedAddresses, treasury } =
        await loadFixture(setupFixture);

      await icoFundingPhase(spaceCoin, spaceCoinIco, alice, whitelistedAddresses, treasury);
      await liquidityPoolTreasuryMint(liquidityPool, spaceRouter, spaceCoin, treasury);
    });

    describe("SPC tax active after LP funding", () => {
      it("Deposit liquidity", async () => {
        const { spaceCoin, spaceCoinIco, spaceRouter, liquidityPool, alice, whitelistedAddresses, treasury } =
          await loadFixture(setupFixture);

        await icoFundingPhase(spaceCoin, spaceCoinIco, alice, whitelistedAddresses, treasury);
        await liquidityPoolTreasuryMint(liquidityPool, spaceRouter, spaceCoin, treasury);

        /* alice starts at 50_000 SPC, since contributed for 10_000k in ICO open phase */
        await spaceCoin.toggleTax();
        await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);

        const spcDepositAmount = ONE_ETHER.mul(5);
        const treasuryBalanceBeforeDeposit = await spaceCoin.balanceOf(treasury.address);

        await spaceRouter.connect(alice).deposit(spcDepositAmount, {
          value: ONE_ETHER,
        });
        // treasury is 200_000 -> 350_000 (base) - 150_000 (mint in liquidity pool)
        const spcTaxFee = applySpcTax(spcDepositAmount);
        const minusTax = spcDepositAmount.sub(spcTaxFee);
        let [ethReserve, spcReserve] = await liquidityPool.getReserves();

        expect(ethReserve).to.be.equal(E2E_BASE_ETH_LIQUIDITY.add(ONE_ETHER));
        expect(spcReserve).to.be.equal(E2E_BASE_SPC_LIQUIDITY.add(minusTax));
        expect(await spaceCoin.balanceOf(treasury.address)).to.be.equal(treasuryBalanceBeforeDeposit.add(spcTaxFee));
        expect(spcTaxFee).to.be.equal(ethers.utils.parseEther("0.1"));
        expect(minusTax).to.be.equal(ethers.utils.parseEther("4.9"));
      });

      it("Withdraw liquidity", async () => {
        const { spaceCoin, spaceCoinIco, spaceRouter, liquidityPool, alice, whitelistedAddresses, treasury } =
          await loadFixture(setupFixture);

        await icoFundingPhase(spaceCoin, spaceCoinIco, alice, whitelistedAddresses, treasury);
        await liquidityPoolTreasuryMint(liquidityPool, spaceRouter, spaceCoin, treasury);

        /* alice starts at 50_000 SPC, since contributed for 10_000k in ICO open phase */
        await spaceCoin.toggleTax();
        await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);

        const spcDepositAmount = ONE_ETHER.mul(5);

        await spaceRouter.connect(alice).deposit(spcDepositAmount, {
          value: ONE_ETHER,
        });

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve).to.be.equal(E2E_BASE_ETH_LIQUIDITY.add(ONE_ETHER));

        let spcTaxFee = applySpcTax(spcDepositAmount);
        const minusTax = spcDepositAmount.sub(spcTaxFee);

        expect(spcTaxFee).to.be.equal(ethers.utils.parseEther("0.1"));
        expect(minusTax).to.be.equal(ethers.utils.parseEther("4.9"));

        expect(spcReserve).to.be.equal(E2E_BASE_SPC_LIQUIDITY.add(minusTax));

        const ALICE_LP_TOKENS = await liquidityPool.balanceOf(alice.address);
        await liquidityPool.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
        /* 
        await expect(spaceRouter.connect(alice).withdraw( ALICE_LP_TOKENS))
          .to.be.revertedWithCustomError(spaceRouter, "InsufficientAmount")
          .withArgs(980000653311991808n, ONE_ETHER, 4899999999999999998n, spcDepositAmount);
 */
        [ethReserve, spcReserve] = await liquidityPool.getReserves();

        const spcBeforeWithdraw = await spaceCoin.balanceOf(alice.address);
        const spcTreasuryBeforeWithdraw = await spaceCoin.balanceOf(treasury.address);
        const expectedSpcWithoutTax = ALICE_LP_TOKENS.mul(spcReserve).div(await liquidityPool.totalSupply());
        const expectedSpcReceived = expectedSpcWithoutTax.sub(applySpcTax(expectedSpcWithoutTax));

        const treasuryBalanceBeforeWithdraw = await spaceCoin.balanceOf(treasury.address);
        await spaceRouter.connect(alice).withdraw(ALICE_LP_TOKENS);

        spcTaxFee = applySpcTax(expectedSpcWithoutTax);
        expect(await spaceCoin.balanceOf(treasury.address)).to.be.equal(treasuryBalanceBeforeWithdraw.add(spcTaxFee));
        expect(await spaceCoin.balanceOf(alice.address)).to.be.equal(spcBeforeWithdraw.add(expectedSpcReceived));
        expect(await spaceCoin.balanceOf(treasury.address)).to.be.equal(spcTreasuryBeforeWithdraw.add(spcTaxFee));
      });

      it("Swap ETH for SPC", async () => {
        const { spaceCoin, spaceCoinIco, spaceRouter, liquidityPool, alice, whitelistedAddresses, treasury } =
          await loadFixture(setupFixture);

        await icoFundingPhase(spaceCoin, spaceCoinIco, alice, whitelistedAddresses, treasury);
        await liquidityPoolTreasuryMint(liquidityPool, spaceRouter, spaceCoin, treasury);

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve).to.be.equal(E2E_BASE_ETH_LIQUIDITY);
        expect(spcReserve).to.be.equal(E2E_BASE_SPC_LIQUIDITY);

        await spaceCoin.toggleTax();

        const spcBalanceBeforeSwap = await spaceCoin.balanceOf(alice.address);
        const spcOutNoTaxFeeExpected = await spaceRouter
          .connect(alice)
          .getAmountReceived(ONE_ETHER, ethReserve, spcReserve);

        const spcTaxFee = applySpcTax(spcOutNoTaxFeeExpected);
        const finalSpc = spcOutNoTaxFeeExpected.sub(spcTaxFee);
        const treasuryBalanceBeforeWithdraw = await spaceCoin.balanceOf(treasury.address);

        await spaceRouter.connect(alice).swapEthForSpc(apply05percentSlippage(ONE_ETHER.mul(5)), { value: ONE_ETHER });

        [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(await spaceCoin.balanceOf(treasury.address)).to.be.equal(treasuryBalanceBeforeWithdraw.add(spcTaxFee));
        expect(ethReserve).to.be.equal(E2E_BASE_ETH_LIQUIDITY.add(ONE_ETHER));
        expect(spcReserve).to.be.equal(E2E_BASE_SPC_LIQUIDITY.sub(spcOutNoTaxFeeExpected));
        expect(await spaceCoin.balanceOf(alice.address)).to.be.equal(spcBalanceBeforeSwap.add(finalSpc));
      });

      it("Swap SPC for ETH", async () => {
        const { spaceCoin, spaceCoinIco, spaceRouter, liquidityPool, alice, whitelistedAddresses, treasury } =
          await loadFixture(setupFixture);

        await icoFundingPhase(spaceCoin, spaceCoinIco, alice, whitelistedAddresses, treasury);
        await liquidityPoolTreasuryMint(liquidityPool, spaceRouter, spaceCoin, treasury);

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve).to.be.equal(E2E_BASE_ETH_LIQUIDITY);
        expect(spcReserve).to.be.equal(E2E_BASE_SPC_LIQUIDITY);

        await spaceCoin.toggleTax();

        const spcDepositAmount = ONE_ETHER.mul(5);
        const ethBalanceBeforeSwap = await alice.getBalance();
        const finalEth = await spaceRouter.connect(alice).getAmountReceived(spcDepositAmount, spcReserve, ethReserve);

        const spcTaxFee = applySpcTax(spcDepositAmount);
        const treasuryBalanceBeforeWithdraw = await spaceCoin.balanceOf(treasury.address);

        await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
        await spaceRouter.connect(alice).swapSpcForEth(spcDepositAmount, apply05percentSlippage(ONE_ETHER));

        [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(await spaceCoin.balanceOf(treasury.address)).to.be.equal(treasuryBalanceBeforeWithdraw.add(spcTaxFee));
        expect(ethReserve).to.be.closeTo(E2E_BASE_ETH_LIQUIDITY.sub(ONE_ETHER), CLOSE_TO_TOLERANCE);
        expect(spcReserve).to.be.equal(E2E_BASE_SPC_LIQUIDITY.add(spcDepositAmount.sub(applySpcTax(spcDepositAmount))));
        expect(await alice.getBalance()).to.be.closeTo(ethBalanceBeforeSwap.add(finalEth), CLOSE_TO_TOLERANCE);
        /* expect(await spaceCoin.balanceOf(alice.address)).to.be.equal(spcBalanceBeforeSwap.add(finalSpc)); */
      });
    });
  });
});
