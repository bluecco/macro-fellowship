import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SpaceCoin, LiquidityPool, SpaceRouter } from "../typechain-types";
import {
  baseMint,
  ONE_ETHER,
  BASE_ETH_LIQUIDITY,
  BASE_SPC_LIQUIDITY,
  CLOSE_TO_TOLERANCE,
  apply05percentSlippage,
} from "./helpers/helpers";

const getExpectedLiquidity = async (liquidityPool: LiquidityPool): Promise<BigNumber> => {
  const totalSupply = await liquidityPool.totalSupply();
  const [ethReserve, spcReserve] = await liquidityPool.getReserves();
  return ONE_ETHER.mul(totalSupply).div(ethReserve).lt(ONE_ETHER.mul(5).mul(totalSupply).div(spcReserve))
    ? ONE_ETHER.mul(totalSupply).div(ethReserve)
    : ONE_ETHER.mul(5).mul(totalSupply).div(spcReserve);
};

describe("Space Router", () => {
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

  describe("Contract", () => {
    it("Contract it's deployed", async () => {
      const { spaceRouter } = await loadFixture(setupFixtureLiquidityPool);
      expect(spaceRouter.address).not.be.null;
    });
  });
  describe("Get amount received", () => {
    it("Correctly calculate the SPC amount with ETH in", async () => {
      const { spaceRouter, liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
      await baseMint(liquidityPool, spaceCoin, treasury);

      const [ethReserve, spcReserve] = await liquidityPool.getReserves();
      const spcOut = await spaceRouter.getAmountReceived(ONE_ETHER, ethReserve, spcReserve);
      expect(spcOut).to.be.closeTo(ethers.utils.parseEther("4.9"), CLOSE_TO_TOLERANCE);
    });

    it("Correctly calculate the ETH amount with SPC in", async () => {
      const { spaceRouter, liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
      await baseMint(liquidityPool, spaceCoin, treasury);
      const [ethReserve, spcReserve] = await liquidityPool.getReserves();
      const ethOut = await spaceRouter.getAmountReceived(ONE_ETHER.mul(5), spcReserve, ethReserve);
      expect(ethOut).to.be.closeTo(ethers.utils.parseEther("0.98"), CLOSE_TO_TOLERANCE);
    });

    it("Block calculation if amount in is 0", async () => {
      const { spaceRouter, liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
      await baseMint(liquidityPool, spaceCoin, treasury);
      const [ethReserve, spcReserve] = await liquidityPool.getReserves();
      await expect(spaceRouter.getAmountReceived(0, spcReserve, ethReserve)).to.be.revertedWithCustomError(
        spaceRouter,
        "InputAmountInvalid"
      );
    });

    it("Block calculation if a reserveIn is 0", async () => {
      const { spaceRouter, liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
      await baseMint(liquidityPool, spaceCoin, treasury);
      const [ethReserve] = await liquidityPool.getReserves();
      await expect(spaceRouter.getAmountReceived(ONE_ETHER.mul(5), 0, ethReserve))
        .to.be.revertedWithCustomError(spaceRouter, "ReservesAmountInvalid")
        .withArgs(0, ethReserve);
    });

    it("Block calculation if a reserve OUT is 0", async () => {
      const { spaceRouter, liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
      await baseMint(liquidityPool, spaceCoin, treasury);
      const [spcReserve] = await liquidityPool.getReserves();
      await expect(spaceRouter.getAmountReceived(ONE_ETHER.mul(5), spcReserve, 0))
        .to.be.revertedWithCustomError(spaceRouter, "ReservesAmountInvalid")
        .withArgs(spcReserve, 0);
    });
  });

  describe("Add liquidity", () => {
    it("Allow user to add liquidity and receive LP tokens with spc as best amount", async () => {
      const { spaceRouter, alice, liquidityPool, spaceCoin } = await loadFixture(setupFixtureLiquidityPool);

      await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
      await spaceRouter.connect(alice).deposit(ONE_ETHER.mul(5), {
        value: ONE_ETHER,
      });

      let expectedLiquidity = await getExpectedLiquidity(liquidityPool);

      expect(await liquidityPool.balanceOf(alice.address)).to.be.closeTo(expectedLiquidity, CLOSE_TO_TOLERANCE);

      await spaceRouter.connect(alice).deposit(ONE_ETHER.mul(5), {
        value: ONE_ETHER,
      });

      // same liquidity provided, so mul(2)
      expect(await liquidityPool.balanceOf(alice.address)).to.be.closeTo(expectedLiquidity.mul(2), CLOSE_TO_TOLERANCE);
    });

    /* it("Block adding liquidity with wrong eth amount", async () => {
      const { spaceRouter, alice, liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);

      await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
      await expect(
        spaceRouter.connect(alice).deposit(ONE_ETHER, {
          value: ONE_ETHER,
        })
      )
        .to.be.revertedWithCustomError(liquidityPool, "LiquidityWrongRatio")
        .withArgs(ONE_ETHER, ONE_ETHER);
    }); */

    /* it("Block adding liquidity with wrong spc amount", async () => {
      const { spaceRouter, alice, liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
      await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);

      await spaceRouter.connect(alice).deposit(ONE_ETHER.mul(5), {
        value: ONE_ETHER,
      });

      await expect(
        spaceRouter.connect(alice).deposit(ONE_ETHER.mul(32), {
          value: ONE_ETHER.mul(5),
        })
      )
        .to.be.revertedWithCustomError(liquidityPool, "LiquidityWrongRatio")
        .withArgs(ONE_ETHER.mul(5), ONE_ETHER.mul(32));
    }); */

    it("Block adding liquidity with no eth sent", async () => {
      const { spaceRouter, alice, liquidityPool, spaceCoin, treasury } = await loadFixture(setupFixtureLiquidityPool);
      await baseMint(liquidityPool, spaceCoin, treasury);

      await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
      await expect(spaceRouter.connect(alice).deposit(ONE_ETHER.mul(5)))
        .to.be.revertedWithCustomError(liquidityPool, "NoLiquidityProvided")
        .withArgs(alice.address);
    });

    it("Calc optimal amountwith", async () => {
      const { spaceRouter, alice, spaceCoin } = await loadFixture(setupFixtureLiquidityPool);

      await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
      expect(await spaceRouter.connect(alice).calcOptimalAmount(ONE_ETHER, ONE_ETHER, ONE_ETHER.mul(5))).to.be.equal(
        ONE_ETHER.mul(5)
      );
    });

    it("Block calc optimal amountwith no valid input", async () => {
      const { spaceRouter, alice, spaceCoin } = await loadFixture(setupFixtureLiquidityPool);

      await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
      await expect(spaceRouter.connect(alice).calcOptimalAmount(0, 0, 0)).to.be.revertedWithCustomError(
        spaceRouter,
        "InputAmountInvalid"
      );
    });

    it("Block calc optimal amountwith no reserves set", async () => {
      const { spaceRouter, alice, spaceCoin } = await loadFixture(setupFixtureLiquidityPool);

      await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
      await expect(spaceRouter.connect(alice).calcOptimalAmount(ONE_ETHER, 0, 0))
        .to.be.revertedWithCustomError(spaceRouter, "ReservesAmountInvalid")
        .withArgs(0, 0);
    });

    describe("Remove liquidity", () => {
      it("Allow user to remove liquidity", async () => {
        const { spaceRouter, liquidityPool, spaceCoin, treasury, alice } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);

        /* when adding to pool -> increase first */
        await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);

        const spcBeforeMint = await spaceCoin.balanceOf(alice.address);
        const ethBeforeMint = await alice.getBalance();
        let expectedLiquidity = await getExpectedLiquidity(liquidityPool);
        await spaceRouter.connect(alice).deposit(ONE_ETHER.mul(5), {
          value: ONE_ETHER,
        });

        expect(await liquidityPool.balanceOf(alice.address)).to.be.equal(expectedLiquidity);
        expect(await alice.getBalance()).to.be.closeTo(ethBeforeMint.sub(ONE_ETHER), CLOSE_TO_TOLERANCE);
        expect(await spaceCoin.balanceOf(alice.address)).to.be.closeTo(
          spcBeforeMint.sub(ONE_ETHER.mul(5)),
          CLOSE_TO_TOLERANCE
        );

        /* when removeing to pool -> increase first */
        await liquidityPool.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);

        await spaceRouter.connect(alice).withdraw(await liquidityPool.balanceOf(alice.address));
        expect(await liquidityPool.balanceOf(alice.address)).to.be.equal(0);
        expect(await alice.getBalance()).to.be.closeTo(ethBeforeMint, CLOSE_TO_TOLERANCE);
        expect(await spaceCoin.balanceOf(alice.address)).to.be.closeTo(spcBeforeMint, CLOSE_TO_TOLERANCE);
      });

      /* it("Block user to remove liquidity if eth or spc amount are under slippage", async () => {
        const { spaceRouter, liquidityPool, spaceCoin, treasury, alice } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);

        // when adding to pool -> increase first
        await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);

        await spaceRouter.connect(alice).deposit(ONE_ETHER.mul(5), {
          value: ONE_ETHER,
        });

        // when removeing to pool -> increase first
        await liquidityPool.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);
        let expectedLiquidity = await getExpectedLiquidity(liquidityPool);

        await expect(spaceRouter.connect(alice).withdraw(ONE_ETHER.div(10))).to.be.revertedWithCustomError(
          spaceRouter,
          "InsufficientAmount"
        );
        expect(await liquidityPool.balanceOf(alice.address)).to.be.equal(expectedLiquidity);
      }); */
    });

    describe("Swap", () => {
      it("Allow swap eth for spc", async () => {
        const { spaceRouter, alice, treasury, liquidityPool, spaceCoin } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        const spcOut = await spaceRouter.getAmountReceived(ONE_ETHER, ethReserve, spcReserve);
        const ethBalanceBeforeSwap = await alice.getBalance();
        const spcBalanceBeforeSwap = await spaceCoin.balanceOf(alice.address);

        await spaceRouter.connect(alice).swapEthForSpc(apply05percentSlippage(ONE_ETHER), { value: ONE_ETHER });

        [ethReserve, spcReserve] = await liquidityPool.getReserves();

        expect(ethReserve).to.be.equal(BASE_ETH_LIQUIDITY.add(ONE_ETHER));
        expect(spcReserve).to.be.closeTo(BASE_SPC_LIQUIDITY.sub(spcOut), CLOSE_TO_TOLERANCE);
        expect(await alice.getBalance()).to.be.closeTo(ethBalanceBeforeSwap.sub(ONE_ETHER), CLOSE_TO_TOLERANCE);
        expect(await spaceCoin.balanceOf(alice.address)).to.be.closeTo(
          spcBalanceBeforeSwap.add(spcOut),
          CLOSE_TO_TOLERANCE
        );
      });

      it("Allow swap spc for eth", async () => {
        const { spaceRouter, alice, treasury, liquidityPool, spaceCoin } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        const ethOut = await spaceRouter.getAmountReceived(ONE_ETHER.mul(10), spcReserve, ethReserve);
        const ethBalanceBeforeSwap = await alice.getBalance();
        const spcBalanceBeforeSwap = await spaceCoin.balanceOf(alice.address);

        await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);

        await spaceRouter.connect(alice).swapSpcForEth(ONE_ETHER.mul(10), apply05percentSlippage(ONE_ETHER));

        [ethReserve, spcReserve] = await liquidityPool.getReserves();

        expect(ethReserve).to.be.equal(BASE_ETH_LIQUIDITY.sub(ethOut));
        expect(spcReserve).to.be.closeTo(BASE_SPC_LIQUIDITY.add(ONE_ETHER.mul(10)), CLOSE_TO_TOLERANCE);
        expect(await alice.getBalance()).to.be.closeTo(ethBalanceBeforeSwap.add(ethOut), CLOSE_TO_TOLERANCE);
        expect(await spaceCoin.balanceOf(alice.address)).to.be.closeTo(
          spcBalanceBeforeSwap.sub(ONE_ETHER.mul(10)),
          CLOSE_TO_TOLERANCE
        );
      });

      it("Block swap eth for spc if amount out is lower then slippage", async () => {
        const { spaceRouter, alice, treasury, liquidityPool, spaceCoin } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        const spcOut = await spaceRouter.getAmountReceived(ONE_ETHER, ethReserve, spcReserve);

        const ethBalanceBeforeSwap = await alice.getBalance();
        const spcBalanceBeforeSwap = await spaceCoin.balanceOf(alice.address);
        await expect(spaceRouter.connect(alice).swapEthForSpc(ONE_ETHER.mul(10), { value: ONE_ETHER }))
          .to.be.revertedWithCustomError(spaceRouter, "InsufficientSPCAmount")
          .withArgs(spcOut, ONE_ETHER.mul(10));

        expect(await alice.getBalance()).to.be.closeTo(ethBalanceBeforeSwap, CLOSE_TO_TOLERANCE);
        expect(await spaceCoin.balanceOf(alice.address)).to.be.equal(spcBalanceBeforeSwap);
      });

      it("Block swap spc for eth if amount out is lower then slippage", async () => {
        const { spaceRouter, alice, treasury, liquidityPool, spaceCoin } = await loadFixture(setupFixtureLiquidityPool);
        await baseMint(liquidityPool, spaceCoin, treasury);

        let [ethReserve, spcReserve] = await liquidityPool.getReserves();
        const ethOut = await spaceRouter.getAmountReceived(ONE_ETHER.mul(10), spcReserve, ethReserve);
        const ethBalanceBeforeSwap = await alice.getBalance();
        const spcBalanceBeforeSwap = await spaceCoin.balanceOf(alice.address);

        await spaceCoin.connect(alice).increaseAllowance(spaceRouter.address, ethers.constants.MaxUint256);

        await expect(spaceRouter.connect(alice).swapSpcForEth(ONE_ETHER.mul(10), ONE_ETHER.mul(10)))
          .to.be.revertedWithCustomError(spaceRouter, "InsufficientETHAmount")
          .withArgs(ethOut, ONE_ETHER.mul(10));

        expect(await alice.getBalance()).to.be.closeTo(ethBalanceBeforeSwap, CLOSE_TO_TOLERANCE);
        expect(await spaceCoin.balanceOf(alice.address)).to.be.equal(spcBalanceBeforeSwap);
      });
    });
  });
});
