import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  SpaceCoin,
  LiquidityPool,
  SpaceRouter,
  TestRentrancyBurnLock,
  TestRentrancySwapLock,
  TestCallFail,
} from "../typechain-types";
import { sqrt, baseMint, ONE_ETHER, BASE_ETH_LIQUIDITY, BASE_SPC_LIQUIDITY } from "./helpers/helpers";

/* same function that will be used by the router */
const calcAmountOut = (amountIn: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber) => {
  const amountInWithFee = amountIn.mul(99); // 1% fee
  const numerator = amountInWithFee.mul(reserveOut);
  const denominator = reserveIn.mul(100).add(amountInWithFee);
  return numerator.div(denominator);
};

describe("Liquidity Pool", () => {
  async function setupFixtureLiquidityPool() {
    const signers = await ethers.getSigners();
    const [deployer, treasury, alice]: SignerWithAddress[] = signers;

    const SpaceCoin = await ethers.getContractFactory("SpaceCoin");
    const spaceCoin: SpaceCoin = (await SpaceCoin.deploy(treasury.address)) as SpaceCoin;
    await spaceCoin.deployed();

    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool: LiquidityPool = (await LiquidityPool.deploy(spaceCoin.address)) as LiquidityPool;
    await liquidityPool.deployed();

    /* ico supply minted to deployer transferred to treasury for testing reason */
    /* in this impl, ico supply is first minted to the deployed (won't update this behavior in this project) */
    await spaceCoin.transfer(treasury.address, (await spaceCoin.balanceOf(deployer.address)).sub(ONE_ETHER.mul(100)));
    /* rest to alice */
    await spaceCoin.transfer(alice.address, spaceCoin.balanceOf(deployer.address));

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
      spaceRouter,
      deployer,
    };
  }

  describe("LiquidityPool Contract", () => {
    it("Contract it's deployed", async () => {
      const { liquidityPool } = await loadFixture(setupFixtureLiquidityPool);
      expect(liquidityPool.address).not.be.null;
    });
    describe("Mint", () => {
      it("Allow mint of LP token", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
        const balanceETHBeforMint = await treasury.getBalance();
        const balanceSPCbeforeMint = await spaceCoin.balanceOf(treasury.address);

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(0);

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, BASE_SPC_LIQUIDITY);
        await liquidityPool.connect(treasury).mint(treasury.address, { value: BASE_ETH_LIQUIDITY });

        expect((await treasury.getBalance()).toBigInt()).to.be.closeTo(
          balanceETHBeforMint.sub(BASE_ETH_LIQUIDITY).toBigInt(),
          ethers.utils.parseEther("0.005")
        );
        expect((await spaceCoin.balanceOf(treasury.address)).toBigInt()).to.be.equal(
          balanceSPCbeforeMint.sub(BASE_SPC_LIQUIDITY).toBigInt()
        );

        [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(BASE_ETH_LIQUIDITY.mul(BASE_SPC_LIQUIDITY));

        const expectedLP = sqrt(BASE_SPC_LIQUIDITY.mul(BASE_ETH_LIQUIDITY).toString());
        [ethReserve, spcReserve] = await liquidityPool.getReserves();

        expect(await liquidityPool.balanceOf(treasury.address)).to.be.equal(expectedLP.toBigInt());
        expect(ethReserve).to.be.equal(BASE_ETH_LIQUIDITY);
        expect(spcReserve).to.be.equal(BASE_SPC_LIQUIDITY);
      });

      it("Allow multiple mint of LP token", async () => {
        const { liquidityPool, spaceRouter, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(0);

        await baseMint(liquidityPool, spaceCoin, treasury);

        [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(BASE_ETH_LIQUIDITY.mul(BASE_SPC_LIQUIDITY));

        const expectedLP = sqrt(BASE_SPC_LIQUIDITY.mul(BASE_ETH_LIQUIDITY).toString());

        [ethReserve, spcReserve] = await liquidityPool.getReserves();
        let LPinitialMint = await liquidityPool.balanceOf(treasury.address);

        expect(LPinitialMint).to.be.equal(expectedLP.toBigInt());
        expect(ethReserve).to.be.equal(BASE_ETH_LIQUIDITY);
        expect(spcReserve).to.be.equal(BASE_SPC_LIQUIDITY);

        /* second mint */
        const ETH_IN = ethers.utils.parseEther("0.05");
        const SPC_IN = await spaceRouter.calcOptimalAmount(ETH_IN, ethReserve, spcReserve);

        spaceRouter.calcOptimalAmount(ETH_IN, ethReserve, spcReserve);
        spaceRouter.calcOptimalAmount(SPC_IN, spcReserve, ethReserve);

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, SPC_IN);
        await liquidityPool.connect(treasury).mint(treasury.address, { value: ETH_IN });
        [ethReserve, spcReserve] = await liquidityPool.getReserves();

        const TOTAL_SUPPLY = await liquidityPool.totalSupply();
        const liquidityToBe = ETH_IN.mul(TOTAL_SUPPLY).div(ethReserve).lt(SPC_IN.mul(TOTAL_SUPPLY).div(spcReserve))
          ? ETH_IN.mul(TOTAL_SUPPLY).div(ethReserve)
          : SPC_IN.mul(TOTAL_SUPPLY).div(spcReserve);

        expect(ethReserve).to.be.equal(BASE_ETH_LIQUIDITY.add(ETH_IN));
        expect(spcReserve).to.be.equal(BASE_SPC_LIQUIDITY.add(SPC_IN));
        expect(await liquidityPool.balanceOf(treasury.address)).to.be.equal(
          LPinitialMint.add(liquidityToBe).toBigInt()
        );

        [ethReserve, spcReserve] = await liquidityPool.getReserves();

        expect(ethReserve.mul(spcReserve)).to.be.equal(
          BASE_ETH_LIQUIDITY.add(ETH_IN).mul(BASE_SPC_LIQUIDITY.add(SPC_IN)).toBigInt()
        );

        const ETH_IN2 = ethers.utils.parseEther("0.05");
        const SPC_IN2 = await spaceRouter.calcOptimalAmount(ETH_IN, ethReserve, spcReserve);

        spaceRouter.calcOptimalAmount(ETH_IN2, ethReserve, spcReserve);
        spaceRouter.calcOptimalAmount(SPC_IN2, spcReserve, ethReserve);
      });

      it("Emit a 'Minted' event after mint of LP token", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(0);

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, BASE_SPC_LIQUIDITY);

        const tx = await liquidityPool.connect(treasury).mint(treasury.address, { value: BASE_ETH_LIQUIDITY });
        await tx.wait();

        [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(BASE_ETH_LIQUIDITY.mul(BASE_SPC_LIQUIDITY));

        await expect(tx)
          .to.emit(liquidityPool, "Minted")
          .withArgs(treasury.address, BASE_ETH_LIQUIDITY, BASE_SPC_LIQUIDITY);
      });

      it("Block mint LP token if no SPC were transferred to the contract balance", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);
        await expect(
          liquidityPool.connect(treasury).mint(treasury.address, { value: 0 })
        ).to.be.revertedWithCustomError(liquidityPool, "NoLiquidityProvided");
      });

      it("Block mint LP token if no liquidity is provided", async () => {
        const { liquidityPool, treasury } = await loadFixture(setupFixtureLiquidityPool);
        await expect(liquidityPool.connect(treasury).mint(treasury.address, { value: 0 }))
          .to.be.revertedWithCustomError(liquidityPool, "NoLiquidityProvided")
          .withArgs(treasury.address);
      });
    });

    describe("Burn", () => {
      it("Allow Burn LP token", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
        const balanceETHBeforMint = await treasury.getBalance();
        const balanceSPCbeforeMint = await spaceCoin.balanceOf(treasury.address);

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();

        expect(ethReserve.mul(spcReserve)).to.be.equal(0);

        await baseMint(liquidityPool, spaceCoin, treasury);

        [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(BASE_ETH_LIQUIDITY.mul(BASE_SPC_LIQUIDITY));

        const expectedLP = sqrt(BASE_SPC_LIQUIDITY.mul(BASE_ETH_LIQUIDITY).toString());
        [ethReserve, spcReserve] = await liquidityPool.getReserves();

        expect(await liquidityPool.balanceOf(treasury.address)).to.be.equal(expectedLP.toBigInt());
        expect(ethReserve).to.be.equal(BASE_ETH_LIQUIDITY);
        expect(spcReserve).to.be.equal(BASE_SPC_LIQUIDITY);

        const liquidity = await liquidityPool.balanceOf(treasury.address);
        await liquidityPool
          .connect(treasury)
          .transfer(liquidityPool.address, liquidityPool.balanceOf(treasury.address));

        await liquidityPool.connect(treasury).burn(liquidity, treasury.address);

        expect(await liquidityPool.balanceOf(treasury.address)).to.be.equal(0);
        expect((await treasury.getBalance()).toBigInt()).to.be.closeTo(
          balanceETHBeforMint.toBigInt(),
          ethers.utils.parseEther("0.005")
        );
        expect((await spaceCoin.balanceOf(treasury.address)).toBigInt()).to.be.equal(balanceSPCbeforeMint.toBigInt());
      });

      it("Emit a 'Burned' event after burning LP token", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, BASE_SPC_LIQUIDITY);
        await liquidityPool.connect(treasury).mint(treasury.address, { value: BASE_ETH_LIQUIDITY });

        const liquidity = await liquidityPool.balanceOf(treasury.address);
        await liquidityPool
          .connect(treasury)
          .transfer(liquidityPool.address, liquidityPool.balanceOf(treasury.address));

        const tx = await liquidityPool.connect(treasury).burn(liquidity, treasury.address);
        await tx.wait();

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(0);

        await expect(tx)
          .to.emit(liquidityPool, "Burned")
          .withArgs(treasury.address, BASE_ETH_LIQUIDITY, BASE_SPC_LIQUIDITY);
      });

      it("Block burn LP token if no liquidity is provided", async () => {
        const { liquidityPool, treasury } = await loadFixture(setupFixtureLiquidityPool);
        await expect(
          liquidityPool.connect(treasury).burn(await liquidityPool.balanceOf(treasury.address), treasury.address)
        ).to.be.revertedWithCustomError(liquidityPool, "NoLiquidityInPool");
      });

      it("Block burn LP token if user has not added liquidity", async () => {
        const { liquidityPool, spaceCoin, treasury, alice } = await loadFixture(setupFixtureLiquidityPool);
        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(0);

        await baseMint(liquidityPool, spaceCoin, treasury);

        [ethReserve, spcReserve] = await liquidityPool.getReserves();
        expect(ethReserve.mul(spcReserve)).to.be.equal(BASE_ETH_LIQUIDITY.mul(BASE_SPC_LIQUIDITY));

        await expect(liquidityPool.connect(alice).burn(0, treasury.address))
          .to.be.revertedWithCustomError(liquidityPool, "InsuffiecientLiquidityBurned")
          .withArgs(0, 0);
      });

      it("Block burn LP token if lock guard is active", async () => {
        const { liquidityPool, spaceCoin, alice, treasury } = await loadFixture(setupFixtureLiquidityPool);

        const TestRentrancyBurnLock = await ethers.getContractFactory("TestRentrancyBurnLock");
        const attacker: TestRentrancyBurnLock = (await TestRentrancyBurnLock.deploy(liquidityPool.address, {
          value: ethers.utils.parseEther("10"),
        })) as TestRentrancyBurnLock;
        await attacker.deployed();

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, BASE_SPC_LIQUIDITY);
        await liquidityPool.connect(treasury).mint(treasury.address, { value: BASE_ETH_LIQUIDITY });

        await spaceCoin.connect(alice).transfer(liquidityPool.address, ONE_ETHER.mul(5));
        await liquidityPool.connect(treasury).mint(treasury.address, { value: ONE_ETHER });

        await liquidityPool
          .connect(treasury)
          .transfer(liquidityPool.address, liquidityPool.balanceOf(treasury.address));
        await expect(attacker.testRentrancyLock()).to.be.revertedWithCustomError(liquidityPool, "LiquidityPoolLocked");
        expect(await ethers.provider.getBalance(attacker.address)).to.be.equals(ethers.utils.parseEther("10"));
      });

      it("Block burn LP token if lock to.call fails for some reason", async () => {
        const { liquidityPool, spaceCoin, alice, treasury } = await loadFixture(setupFixtureLiquidityPool);

        const TestCallFail = await ethers.getContractFactory("TestCallFail");
        const testCallFail: TestCallFail = (await TestCallFail.deploy(liquidityPool.address, {
          value: ethers.utils.parseEther("10"),
        })) as TestCallFail;
        await testCallFail.deployed();

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, BASE_SPC_LIQUIDITY);
        await liquidityPool.connect(treasury).mint(treasury.address, { value: BASE_ETH_LIQUIDITY });

        await spaceCoin.connect(alice).transfer(liquidityPool.address, ONE_ETHER.mul(5));
        await liquidityPool.connect(alice).mint(alice.address, { value: ONE_ETHER });

        await liquidityPool
          .connect(treasury)
          .transfer(liquidityPool.address, liquidityPool.balanceOf(treasury.address));
        await expect(testCallFail.testCallBurnFail()).to.be.revertedWithCustomError(
          liquidityPool,
          "BurnTransferEthToError"
        );
        expect(await ethers.provider.getBalance(testCallFail.address)).to.be.equals(ethers.utils.parseEther("10"));
      });
    });

    describe("Swap", () => {
      it("Allow swap ETH for SPC", async () => {
        const { liquidityPool, spaceCoin, treasury, alice } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);
        let [ethReserve, spcReserve] = await liquidityPool.getReserves();

        const aliceETHBalanceBeforeSwap = await alice.getBalance();
        const aliceSPCBalanceBeforeSwap = await spaceCoin.balanceOf(alice.address);
        const amountOut = calcAmountOut(ONE_ETHER, ethReserve, spcReserve);
        await liquidityPool.connect(alice).swap(alice.address, { value: ONE_ETHER });

        expect(await alice.getBalance()).to.be.closeTo(aliceETHBalanceBeforeSwap, ethers.utils.parseEther("1.5"));
        expect(await spaceCoin.balanceOf(alice.address)).to.be.equal(aliceSPCBalanceBeforeSwap.add(amountOut));
        [ethReserve, spcReserve] = await liquidityPool.getReserves();

        expect(ethReserve).to.be.equal(BASE_ETH_LIQUIDITY.add(ONE_ETHER));
        expect(spcReserve).to.be.equal(BASE_SPC_LIQUIDITY.sub(amountOut));
      });

      it("Allow swap SPC for ETH", async () => {
        const { liquidityPool, spaceCoin, treasury, alice } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);
        let [ethReserve, spcReserve] = await liquidityPool.getReserves();

        const aliceETHBalanceBeforeSwap = await alice.getBalance();
        const aliceSPCBalanceBeforeSwap = await spaceCoin.balanceOf(alice.address);
        const amountOut = calcAmountOut(ONE_ETHER.mul(5), spcReserve, ethReserve);
        await spaceCoin.connect(alice).transfer(liquidityPool.address, ONE_ETHER.mul(5));

        await liquidityPool.connect(alice).swap(alice.address);
        expect(await alice.getBalance()).to.be.closeTo(
          aliceETHBalanceBeforeSwap.add(amountOut),
          ethers.utils.parseEther("1")
        );
        expect(await spaceCoin.balanceOf(alice.address)).to.be.equal(aliceSPCBalanceBeforeSwap.sub(ONE_ETHER.mul(5)));
        [ethReserve, spcReserve] = await liquidityPool.getReserves();

        expect(ethReserve).to.be.equal(BASE_ETH_LIQUIDITY.sub(amountOut));
        expect(spcReserve).to.be.equal(BASE_SPC_LIQUIDITY.add(ONE_ETHER.mul(5)));
      });

      it("Emit a 'Swapped' event after a swap", async () => {
        const { liquidityPool, spaceCoin, treasury, alice } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);
        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        const amountOut = calcAmountOut(ONE_ETHER, ethReserve, spcReserve);

        const tx = await liquidityPool.connect(alice).swap(alice.address, { value: ONE_ETHER });
        await tx.wait();
        await expect(tx)
          .to.emit(liquidityPool, "Swapped")
          .withArgs(alice.address, "ETH_FOR_SPC", ONE_ETHER, 0, 0, amountOut);
      });

      it("Block swap if spc were not transfered to balance", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);

        await expect(liquidityPool.swap(treasury.address)).to.be.revertedWithCustomError(
          liquidityPool,
          "InsufficientInAmount"
        );
      });

      it("Block swap if amounts are 0", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);

        await expect(liquidityPool.swap(treasury.address))
          .to.be.revertedWithCustomError(liquidityPool, "InsufficientInAmount")
          .withArgs(0, 0);
      });

      it("Block swap if ETH and SPC are not moved to the lp", async () => {
        const { liquidityPool, alice, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
        await spaceCoin.connect(treasury).transfer(liquidityPool.address, 1);
        await expect(liquidityPool.swap(alice.address)).to.be.revertedWithCustomError(
          liquidityPool,
          "ReservesAmountInvalid"
        );
      });

      it("Block swap if both ETH and SPC are sent", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, ONE_ETHER.mul(5));
        await liquidityPool.connect(treasury).mint(treasury.address, { value: ONE_ETHER });

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, ONE_ETHER);
        await expect(liquidityPool.swap(treasury.address, { value: ONE_ETHER }))
          .to.be.revertedWithCustomError(liquidityPool, "OnlyOneTokenInAllowed")
          .withArgs(ONE_ETHER, ONE_ETHER);
      });

      it("Block swap if ETH and SPC are not moved to the lp", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);
        await expect(liquidityPool.swap(treasury.address))
          .to.be.revertedWithCustomError(liquidityPool, "InsufficientInAmount")
          .withArgs(0, 0);
      });
      it("Block swap if lock guard is active", async () => {
        const { liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);

        const TestRentrancySwapLock = await ethers.getContractFactory("TestRentrancySwapLock");
        const attacker: TestRentrancySwapLock = (await TestRentrancySwapLock.deploy(liquidityPool.address, {
          value: ethers.utils.parseEther("1"),
        })) as TestRentrancySwapLock;
        await attacker.deployed();

        await baseMint(liquidityPool, spaceCoin, treasury);

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, ONE_ETHER.div(2));
        await expect(attacker.testRentrancyLock()).to.be.revertedWithCustomError(liquidityPool, "LiquidityPoolLocked");
        expect(await ethers.provider.getBalance(attacker.address)).to.be.equals(ethers.utils.parseEther("1"));
      });

      it("Block swap if lock to.call fails for some reason", async () => {
        const { liquidityPool, spaceCoin, alice, treasury } = await loadFixture(setupFixtureLiquidityPool);

        const TestCallFail = await ethers.getContractFactory("TestCallFail");
        const testCallFail: TestCallFail = (await TestCallFail.deploy(liquidityPool.address, {
          value: ethers.utils.parseEther("1"),
        })) as TestCallFail;
        await testCallFail.deployed();

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, BASE_SPC_LIQUIDITY);
        await liquidityPool.connect(treasury).mint(treasury.address, { value: BASE_ETH_LIQUIDITY });

        await spaceCoin.connect(alice).transfer(liquidityPool.address, ONE_ETHER.mul(5));
        await liquidityPool.connect(alice).mint(alice.address, { value: ONE_ETHER });

        await spaceCoin.connect(treasury).transfer(liquidityPool.address, ONE_ETHER.div(2));
        await liquidityPool
          .connect(treasury)
          .transfer(liquidityPool.address, liquidityPool.balanceOf(treasury.address));
        await expect(testCallFail.testCallSwapFail()).to.be.revertedWithCustomError(
          liquidityPool,
          "SwapTransferEthToError"
        );
        expect(await ethers.provider.getBalance(testCallFail.address)).to.be.equals(ethers.utils.parseEther("1"));
      });
    });
  });
});
