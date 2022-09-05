import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SpaceCoin, SpaceCoinIco } from "../typechain-types";

const ONE_ETHER: BigNumber = ethers.utils.parseEther("1");
const MAX_ETHER_WALLET: BigNumber = ethers.utils.parseEther("10000");
const TOTAL_SUPPLY: BigNumber = ethers.utils.parseEther("500000");
const TREASURY_SUPPLY: BigNumber = ethers.utils.parseEther("350000");
const ICO_SUPPLY: BigNumber = ethers.utils.parseEther("150000");

const SEED_PHASE_CONTRIBUTION_LIMIT: BigNumber = ethers.utils.parseEther("1500");
const GENERAL_PHASE_CONTRIBUTION_LIMIT: BigNumber = ethers.utils.parseEther("1000");
const SEED_PHASE_GOAL: BigNumber = ethers.utils.parseEther("15000");
const ICO_GOAL: BigNumber = ethers.utils.parseEther("30000");

enum IcoPhase {
  SEED,
  GENERAL,
  OPEN,
}

describe("SpaceCoin", () => {
  async function setupFixture() {
    const signers = await ethers.getSigners();
    const [deployer, treasury]: SignerWithAddress[] = signers;

    // use from third address to exclude deployer and treasury till the second last (last one will be non whitelisted)
    const whitelistedAddresses = signers.splice(3, signers.length - 2);

    // just use the last address as non-whitelisted for simplicity
    const nonWhitelistedInvestor = signers[signers.length - 1];

    const SpaceCoin = await ethers.getContractFactory("SpaceCoin");
    const spaceCoin: SpaceCoin = (await SpaceCoin.deploy(treasury.address)) as SpaceCoin;
    await spaceCoin.deployed();

    const spaceCoinIco = (await ethers.getContractAt("SpaceCoinIco", await spaceCoin.ico())) as SpaceCoinIco;

    for (let investor of whitelistedAddresses) {
      await spaceCoinIco.addInvestor(investor.address);
    }

    return {
      whitelistedAddresses,
      treasury,
      nonWhitelistedInvestor,
      spaceCoin,
      spaceCoinIco,
      deployer,
    };
  }

  describe("Token Contract", () => {
    const _name = "SpaceCoin";
    const _symbol = "SPC";

    it("Contract it's deployed", async () => {
      const [_, treasury]: SignerWithAddress[] = await ethers.getSigners();
      const SpaceCoin = await ethers.getContractFactory("SpaceCoin");
      const spaceCoin: SpaceCoin = (await SpaceCoin.deploy(treasury.address)) as SpaceCoin;
      await spaceCoin.deployed();
      expect(spaceCoin.address).not.be.null;
    });

    it("Contract it's not deployed with treasury set with address 0x0", async () => {
      const SpaceCoin = await ethers.getContractFactory("SpaceCoin");
      await expect(SpaceCoin.deploy("0x0000000000000000000000000000000000000000")).to.be.rejectedWith();
      await expect(SpaceCoin.deploy("0x0")).to.be.rejectedWith();
      await expect(SpaceCoin.deploy("0")).to.be.rejectedWith();
    });

    it("Is named SpaceCoin", async () => {
      const { spaceCoin } = await loadFixture(setupFixture);
      expect(await spaceCoin.name()).to.be.equal(_name);
    });

    it("Is represented by SPC symbol", async () => {
      const { spaceCoin } = await loadFixture(setupFixture);
      expect(await spaceCoin.symbol()).to.be.equal(_symbol);
    });

    it("Has a total supply of 500000", async () => {
      const { spaceCoin } = await loadFixture(setupFixture);
      expect(await spaceCoin.totalSupply()).to.be.equal(TOTAL_SUPPLY);
    });

    it("Allocates 150000 SPC of supply for the ICO", async () => {
      const { spaceCoin, spaceCoinIco } = await loadFixture(setupFixture);
      expect(await spaceCoin.balanceOf(spaceCoinIco.address)).to.be.equal(ICO_SUPPLY);
      expect(await spaceCoin.totalSupply()).to.be.equal(TOTAL_SUPPLY);
    });

    it("Allocates remaining 350000 SPC of supply to the treasury", async () => {
      const { spaceCoin, treasury } = await loadFixture(setupFixture);
      expect(await spaceCoin.balanceOf(treasury.address)).to.be.equal(TREASURY_SUPPLY);
    });

    it("Allows onwer to toggle the transaction tax of 2% on every transaction", async () => {
      const { spaceCoin } = await loadFixture(setupFixture);
      expect(await spaceCoin.isTaxActive()).to.be.false;
      await spaceCoin.toggleTax();
      expect(await spaceCoin.isTaxActive()).to.be.true;
      await spaceCoin.toggleTax();
      expect(await spaceCoin.isTaxActive()).to.be.false;
    });

    it("Prevent non-owner to toggle the transaction tax", async () => {
      const { spaceCoin, whitelistedAddresses, nonWhitelistedInvestor } = await loadFixture(setupFixture);
      const [alice] = whitelistedAddresses;

      expect(await spaceCoin.isTaxActive()).to.be.false;
      await expect(spaceCoin.connect(alice).toggleTax())
        .to.be.revertedWithCustomError(spaceCoin, "MustBeOwner")
        .withArgs("NOT_OWNER");
      await expect(spaceCoin.connect(nonWhitelistedInvestor).toggleTax())
        .to.be.revertedWithCustomError(spaceCoin, "MustBeOwner")
        .withArgs("NOT_OWNER");
      expect(await spaceCoin.isTaxActive()).to.be.false;
    });

    it("Apply 2% transaction tax and send it to the treasury account when tax is active", async () => {
      const { spaceCoin, spaceCoinIco, whitelistedAddresses, treasury } = await loadFixture(setupFixture);
      const [alice] = whitelistedAddresses;

      await spaceCoin.toggleTax();
      await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
      await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);
      await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("20") });

      expect(await spaceCoin.balanceOf(treasury.address)).to.be.equal(
        TREASURY_SUPPLY.add(ethers.utils.parseEther("2"))
      );
    });
  });

  describe("SpaceCoinIco", () => {
    describe("Deployment", () => {
      it("Contract it's deployed", async () => {
        const { spaceCoinIco } = await loadFixture(setupFixture);
        expect(spaceCoinIco.address).not.be.null;
      });
    });

    describe("Phase Management", () => {
      it("Allow owner to advance phase forward from SEED to OPEN", async () => {
        const { spaceCoinIco } = await loadFixture(setupFixture);
        expect(await spaceCoinIco.currentPhase()).to.be.equal(0);
        await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
        expect(await spaceCoinIco.currentPhase()).to.be.equal(1);
        await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);
        expect(await spaceCoinIco.currentPhase()).to.be.equal(2);
      });

      it("Prevent non owners from advancing phase forward", async () => {
        const { spaceCoinIco, whitelistedAddresses, nonWhitelistedInvestor } = await loadFixture(setupFixture);
        const [alice] = whitelistedAddresses;
        expect(await spaceCoinIco.currentPhase()).to.be.equal(0);
        await expect(spaceCoinIco.connect(alice).phaseAdvance(IcoPhase.SEED))
          .to.be.revertedWithCustomError(spaceCoinIco, "MustBeOwner")
          .withArgs("NOT_OWNER");
        await expect(spaceCoinIco.connect(nonWhitelistedInvestor).phaseAdvance(IcoPhase.GENERAL))
          .to.be.revertedWithCustomError(spaceCoinIco, "MustBeOwner")
          .withArgs("NOT_OWNER");
        expect(await spaceCoinIco.currentPhase()).to.be.equal(0);
      });

      it("Block advancing phase if wrong phase is given", async () => {
        const { spaceCoinIco, whitelistedAddresses, nonWhitelistedInvestor } = await loadFixture(setupFixture);
        const [alice] = whitelistedAddresses;
        const currentPhase = await spaceCoinIco.currentPhase();
        expect(currentPhase).to.be.equal(0);
        await expect(spaceCoinIco.phaseAdvance(IcoPhase.GENERAL))
          .to.be.revertedWithCustomError(spaceCoinIco, "InvalidPhase")
          .withArgs(currentPhase, IcoPhase.GENERAL);
        await expect(spaceCoinIco.phaseAdvance(IcoPhase.OPEN))
          .to.be.revertedWithCustomError(spaceCoinIco, "InvalidPhase")
          .withArgs(currentPhase, IcoPhase.OPEN);
        expect(await spaceCoinIco.currentPhase()).to.be.equal(0);
      });

      it('Emits "PhaseAdvanced" event after phase is advanced', async () => {
        const { spaceCoinIco } = await loadFixture(setupFixture);
        let nextPhaseTxn = await spaceCoinIco.phaseAdvance(IcoPhase.SEED);

        await nextPhaseTxn.wait();
        await expect(nextPhaseTxn).to.emit(spaceCoinIco, "PhaseAdvanced").withArgs(1);

        nextPhaseTxn = await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

        await nextPhaseTxn.wait();
        await expect(nextPhaseTxn).to.emit(spaceCoinIco, "PhaseAdvanced").withArgs(2);

        await expect(spaceCoinIco.phaseAdvance(IcoPhase.OPEN))
          .to.be.revertedWithCustomError(spaceCoinIco, "WrongPhase")
          .withArgs("ALREADY_IN_OPEN_PHASE");
      });
    });

    describe("Pause/Resume", () => {
      it("Allow onwer to pause and resume the ICO", async () => {
        const { spaceCoinIco } = await loadFixture(setupFixture);
        expect(await spaceCoinIco.paused()).to.be.false;
        await spaceCoinIco.togglePause();
        expect(await spaceCoinIco.paused()).to.be.true;
        await spaceCoinIco.togglePause();
        expect(await spaceCoinIco.paused()).to.be.false;
      });

      it("Prevent non owner to pause or resume the ICO", async () => {
        const { spaceCoinIco, whitelistedAddresses, nonWhitelistedInvestor } = await loadFixture(setupFixture);
        const [alice] = whitelistedAddresses;
        expect(await spaceCoinIco.paused()).to.be.false;

        await expect(spaceCoinIco.connect(alice).togglePause())
          .to.be.revertedWithCustomError(spaceCoinIco, "MustBeOwner")
          .withArgs("NOT_OWNER");
        await expect(spaceCoinIco.connect(nonWhitelistedInvestor).togglePause())
          .to.be.revertedWithCustomError(spaceCoinIco, "MustBeOwner")
          .withArgs("NOT_OWNER");

        expect(await spaceCoinIco.paused()).to.be.false;
      });

      it('Emit "Pause" event when setting Pause/Resume', async () => {
        const { spaceCoinIco } = await loadFixture(setupFixture);
        expect(await spaceCoinIco.paused()).to.be.false;
        await expect(spaceCoinIco.togglePause()).to.emit(spaceCoinIco, "Paused").withArgs(true);
        expect(await spaceCoinIco.paused()).to.be.true;
        await spaceCoinIco.togglePause();
        expect(await spaceCoinIco.paused())
          .to.emit(spaceCoinIco, "Paused")
          .withArgs(false);
      });
    });

    describe("Funding and Tokens Redemption", () => {
      describe("Seed Phase", () => {
        it("Allows contributions from whitelisted investors", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);

          let currentContribution = ethers.utils.parseEther("0");
          for (let i = 0; i < 10; i++) {
            const investor = whitelistedAddresses[i];
            await spaceCoinIco.connect(investor).contribute({ value: ONE_ETHER });
            currentContribution = currentContribution.add(ONE_ETHER);
            expect(await spaceCoinIco.amountRaised()).to.be.equal(currentContribution);
          }
        });

        it("Block contributions from non whitelisted investors", async () => {
          const { spaceCoinIco, nonWhitelistedInvestor } = await loadFixture(setupFixture);
          await expect(spaceCoinIco.connect(nonWhitelistedInvestor).contribute({ value: ONE_ETHER }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeAllowed")
            .withArgs("NOT_ALLOWED", nonWhitelistedInvestor.address);
        });

        it("Prevents contributions with amount equals to 0", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await expect(spaceCoinIco.connect(alice).contribute({ value: 0 }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeGreaterThanZero")
            .withArgs("AMOUNT_IS_ZERO");
        });

        it("Prevents contributions above personal limit from whitelisted investors", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice, bob] = whitelistedAddresses;

          await expect(spaceCoinIco.connect(alice).contribute({ value: SEED_PHASE_CONTRIBUTION_LIMIT.add(1) }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeUnderLimit")
            .withArgs("ABOVE_PERSONAL_LIMIT", SEED_PHASE_CONTRIBUTION_LIMIT.add(1), SEED_PHASE_CONTRIBUTION_LIMIT);
          await expect(spaceCoinIco.connect(bob).contribute({ value: SEED_PHASE_CONTRIBUTION_LIMIT.add(1) }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeUnderLimit")
            .withArgs("ABOVE_PERSONAL_LIMIT", SEED_PHASE_CONTRIBUTION_LIMIT.add(1), SEED_PHASE_CONTRIBUTION_LIMIT);
        });

        it("Block contributions above funding phase limit from whitelisted investors", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);

          for (let i = 0; i < 10; i++) {
            await spaceCoinIco.connect(whitelistedAddresses[i]).contribute({ value: SEED_PHASE_CONTRIBUTION_LIMIT });
          }

          await expect(
            spaceCoinIco.connect(whitelistedAddresses[10]).contribute({ value: SEED_PHASE_CONTRIBUTION_LIMIT })
          )
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeUnderLimit")
            .withArgs(
              "ABOVE_ICO_GOAL_LIMIT",
              SEED_PHASE_CONTRIBUTION_LIMIT.mul(10).add(SEED_PHASE_CONTRIBUTION_LIMIT),
              SEED_PHASE_GOAL
            );
          expect(await spaceCoinIco.amountRaised()).to.be.equal(SEED_PHASE_GOAL);
        });

        it('Emit "Contribute" after a contribution', async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          let nextPhaseTxn = await spaceCoinIco.connect(alice).contribute({ value: ONE_ETHER });

          await nextPhaseTxn.wait();
          await expect(nextPhaseTxn).to.emit(spaceCoinIco, "Contribute").withArgs(alice.address, ONE_ETHER);
        });

        it("Block contributions if ICO is paused", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.togglePause();
          await expect(spaceCoinIco.connect(alice).contribute({ value: ONE_ETHER }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeActive")
            .withArgs("ICO_IS_PAUSED");
        });

        it("Block tokens redemption", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          await expect(spaceCoinIco.connect(alice).claimTokens())
            .to.be.revertedWithCustomError(spaceCoinIco, "WrongPhase")
            .withArgs("NOT_OPEN_PHASE");
        });

        it("Allows contributors to earn tokens", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;
          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          const tokens = await spaceCoinIco.connect(alice).addressToContribution(alice.address);
          expect(tokens.mul(5)).to.be.equal(ethers.utils.parseEther("50"));
        });
      });

      describe("General Phase", () => {
        it("Allows contributions from whitelisted investors", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice, bob] = whitelistedAddresses;

          await spaceCoinIco.connect(alice).contribute({ value: ONE_ETHER });
          expect(await spaceCoinIco.amountRaised()).to.be.equal(ONE_ETHER);
          await spaceCoinIco.connect(bob).contribute({ value: ONE_ETHER });
          expect(await spaceCoinIco.amountRaised()).to.be.equal(ONE_ETHER.mul(2));
        });

        it("Allows contributions from non whitelisted investors", async () => {
          const { spaceCoinIco, nonWhitelistedInvestor } = await loadFixture(setupFixture);
          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.connect(nonWhitelistedInvestor).contribute({ value: ONE_ETHER });
          expect(await spaceCoinIco.amountRaised()).to.be.equal(ONE_ETHER);
        });

        it("Allows contributions if investor already invested in Seed phase", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("500") });
          expect(await spaceCoinIco.amountRaised()).to.be.equal(ethers.utils.parseEther("500"));
          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);

          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("500") });
          expect(await spaceCoinIco.amountRaised()).to.be.equal(ethers.utils.parseEther("1000"));
        });

        it("Prevents contributions above personal limit from whitelisted investors", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await expect(spaceCoinIco.connect(alice).contribute({ value: GENERAL_PHASE_CONTRIBUTION_LIMIT.add(1) }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeUnderLimit")
            .withArgs(
              "ABOVE_PERSONAL_LIMIT",
              GENERAL_PHASE_CONTRIBUTION_LIMIT.add(1),
              GENERAL_PHASE_CONTRIBUTION_LIMIT
            );
        });

        it("Prevent contributions from seed investors who are not above general individual limit", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("900") });
          expect(await spaceCoinIco.amountRaised()).to.be.equal(ethers.utils.parseEther("900"));

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);

          await expect(spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("200") }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeUnderLimit")
            .withArgs("ABOVE_PERSONAL_LIMIT", ethers.utils.parseEther("1100"), GENERAL_PHASE_CONTRIBUTION_LIMIT);
        });

        it("Prevent contributions from seed investors who are already above general individual limit", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("1100") });
          expect(await spaceCoinIco.amountRaised()).to.be.equal(ethers.utils.parseEther("1100"));

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);

          await expect(spaceCoinIco.connect(alice).contribute({ value: ONE_ETHER }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeUnderLimit")
            .withArgs(
              "ABOVE_PERSONAL_LIMIT",
              ethers.utils.parseEther("1100").add(ONE_ETHER),
              GENERAL_PHASE_CONTRIBUTION_LIMIT
            );
        });

        it("Block contributions above funding phase limit", async () => {
          const signers = (await ethers.getSigners()).slice(1);
          const { spaceCoinIco } = await loadFixture(setupFixture);
          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          // signers set to 40 accounts in hardhat config, just 30 where enough for testing
          for (let i = 0; i < 30; i++) {
            await spaceCoinIco.connect(signers[i]).contribute({ value: GENERAL_PHASE_CONTRIBUTION_LIMIT });
          }

          await expect(
            spaceCoinIco.connect(signers[signers.length - 1]).contribute({ value: GENERAL_PHASE_CONTRIBUTION_LIMIT })
          )
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeUnderLimit")
            .withArgs("ABOVE_ICO_GOAL_LIMIT", ICO_GOAL.add(GENERAL_PHASE_CONTRIBUTION_LIMIT), ICO_GOAL);
        });

        it('Emit "Contribute" after a contribution', async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);

          let nextPhaseTxn = await spaceCoinIco.connect(alice).contribute({ value: ONE_ETHER });

          await nextPhaseTxn.wait();
          await expect(nextPhaseTxn).to.emit(spaceCoinIco, "Contribute").withArgs(alice.address, ONE_ETHER);
        });

        it("Block contributions if ICO is paused", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.togglePause();

          await expect(spaceCoinIco.connect(alice).contribute({ value: ONE_ETHER }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeActive")
            .withArgs("ICO_IS_PAUSED");
        });

        it("Block tokens redemption", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("10") });

          await expect(spaceCoinIco.connect(alice).claimTokens())
            .to.be.revertedWithCustomError(spaceCoinIco, "WrongPhase")
            .withArgs("NOT_OPEN_PHASE");
        });

        it("Allows contributors to earn tokens", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("10") });

          const tokens = await spaceCoinIco.connect(alice).addressToContribution(alice.address);
          expect(tokens.mul(5)).to.be.equal(ethers.utils.parseEther("50"));
        });
      });

      describe("Open Phase", () => {
        it("Allows contributions for every investor", async () => {
          const { spaceCoinIco, whitelistedAddresses, nonWhitelistedInvestor } = await loadFixture(setupFixture);

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

          let currentContribution = ethers.utils.parseEther("0");
          for (let investor of whitelistedAddresses) {
            await spaceCoinIco.connect(investor).contribute({ value: ONE_ETHER });
            currentContribution = currentContribution.add(ONE_ETHER);
            expect(await spaceCoinIco.amountRaised()).to.be.equal(currentContribution);
          }

          await spaceCoinIco.connect(nonWhitelistedInvestor).contribute({ value: ONE_ETHER });
          currentContribution = currentContribution.add(ONE_ETHER);
          expect(await spaceCoinIco.amountRaised()).to.be.equal(currentContribution);
        });

        it("Allows contributions without individual limit", async () => {
          const { spaceCoinIco, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice, bob] = whitelistedAddresses;

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

          await spaceCoinIco.connect(alice).contribute({ value: SEED_PHASE_CONTRIBUTION_LIMIT.add(ONE_ETHER) });
          expect(await spaceCoinIco.amountRaised()).to.be.equal(SEED_PHASE_CONTRIBUTION_LIMIT.add(ONE_ETHER));

          await spaceCoinIco.connect(bob).contribute({ value: GENERAL_PHASE_CONTRIBUTION_LIMIT.add(ONE_ETHER) });
          expect(await spaceCoinIco.amountRaised()).to.be.equal(
            SEED_PHASE_CONTRIBUTION_LIMIT.add(ONE_ETHER).add(GENERAL_PHASE_CONTRIBUTION_LIMIT).add(ONE_ETHER)
          );
        });

        it("Block contributions above funding phase limit", async () => {
          const signers = (await ethers.getSigners()).slice(1);
          const { spaceCoinIco } = await loadFixture(setupFixture);
          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);
          // signers set to 40 accounts in hardhat config
          const singleContribution = MAX_ETHER_WALLET.sub(ONE_ETHER.mul(1000));
          for (let i = 0; i < 3; i++) {
            // 9999 * 3 and the next one will be enough to trigger the phase limit
            await spaceCoinIco.connect(signers[i]).contribute({ value: singleContribution });
          }

          const contributionToGoal = ONE_ETHER.mul(3000);
          await spaceCoinIco.connect(signers[4]).contribute({ value: contributionToGoal });

          const lastContribution = MAX_ETHER_WALLET.sub(ethers.utils.parseEther("1000"));
          await expect(spaceCoinIco.connect(signers[signers.length - 1]).contribute({ value: lastContribution }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeUnderLimit")
            .withArgs(
              "ABOVE_ICO_GOAL_LIMIT",
              singleContribution.mul(3).add(contributionToGoal).add(lastContribution),
              ICO_GOAL
            );
          expect(await spaceCoinIco.amountRaised()).to.be.equal(ICO_GOAL);
        });

        it('Emit "Contribute" after a contribution', async () => {
          const { spaceCoinIco, nonWhitelistedInvestor } = await loadFixture(setupFixture);

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

          let nextPhaseTxn = await spaceCoinIco.connect(nonWhitelistedInvestor).contribute({ value: ONE_ETHER });
          await nextPhaseTxn.wait();
          await expect(nextPhaseTxn)
            .to.emit(spaceCoinIco, "Contribute")
            .withArgs(nonWhitelistedInvestor.address, ONE_ETHER);
        });

        it("Block contributions if ICO is paused", async () => {
          const { spaceCoinIco, nonWhitelistedInvestor } = await loadFixture(setupFixture);

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);
          await spaceCoinIco.togglePause();

          await expect(spaceCoinIco.connect(nonWhitelistedInvestor).contribute({ value: ONE_ETHER }))
            .to.be.revertedWithCustomError(spaceCoinIco, "MustBeActive")
            .withArgs("ICO_IS_PAUSED");
        });

        it("Prevent token redemption if user doesn't have any", async () => {
          const { spaceCoinIco, nonWhitelistedInvestor } = await loadFixture(setupFixture);

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

          await expect(spaceCoinIco.connect(nonWhitelistedInvestor).claimTokens())
            .to.be.revertedWithCustomError(spaceCoinIco, "MustHaveClaimableTokens")
            .withArgs("NO_CLAIMABLE_TOKENS", nonWhitelistedInvestor.address);
        });

        it("Prevent claim tokens if user contributed in OPEN phase but not in SEED or GENERAL", async () => {
          const { spaceCoinIco, nonWhitelistedInvestor } = await loadFixture(setupFixture);

          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

          await spaceCoinIco.connect(nonWhitelistedInvestor).contribute({ value: ethers.utils.parseEther("10") });
          await expect(spaceCoinIco.connect(nonWhitelistedInvestor).claimTokens())
            .to.be.revertedWithCustomError(spaceCoinIco, "MustHaveClaimableTokens")
            .withArgs("NO_CLAIMABLE_TOKENS", nonWhitelistedInvestor.address);
        });

        it("Allows redemption of tokens gained in SEED or GENERAL", async () => {
          const { spaceCoinIco, spaceCoin, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;
          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("12.5") });
          await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

          await spaceCoinIco.connect(alice).claimTokens();
          expect(await spaceCoin.balanceOf(alice.address)).to.be.equal(ethers.utils.parseEther("112.5"));
        });

        it('Emit a "TokensClaimed" event after tokens tokens redemption', async () => {
          const { spaceCoinIco, spaceCoin, whitelistedAddresses } = await loadFixture(setupFixture);
          const [alice] = whitelistedAddresses;
          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("10") });
          await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
          await spaceCoinIco.connect(alice).contribute({ value: ethers.utils.parseEther("12.5") });
          await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

          const nextPhaseTxn = await spaceCoinIco.connect(alice).claimTokens();
          await nextPhaseTxn.wait();
          await expect(nextPhaseTxn)
            .to.emit(spaceCoinIco, "TokensClaimed")
            .withArgs(alice.address, ethers.utils.parseEther("112.5"));
          expect(await spaceCoin.balanceOf(alice.address)).to.be.equal(ethers.utils.parseEther("112.5"));
        });
      });

      it("Ico reached the goal", async () => {
        const { spaceCoinIco, spaceCoin, whitelistedAddresses } = await loadFixture(setupFixture);

        await spaceCoinIco.phaseAdvance(IcoPhase.SEED);
        await spaceCoinIco.phaseAdvance(IcoPhase.GENERAL);

        expect(await spaceCoinIco.hasReachedIcoGoal()).to.be.false;

        for (let i = 0; i < 6; i++) {
          const investor = whitelistedAddresses[i];
          await spaceCoinIco.connect(investor).contribute({ value: ONE_ETHER.mul(5000) });
        }

        expect(await spaceCoinIco.hasReachedIcoGoal()).to.be.true;
      });
    });
  });
});
