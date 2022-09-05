// ----------------------------------------------------------------------------
// REQUIRED: Instructions
// ----------------------------------------------------------------------------
/*
  For this first project, we've provided a significant amount of scaffolding
  in your test suite. We've done this to:

    1. Set expectations, by example, of where the bar for testing is.
    3. Reduce the amount of time consumed this week by "getting started friction".

  Please note that:

    - We will not be so generous on future projects!
    - The tests provided are about ~90% complete.
    - IMPORTANT:
      - We've intentionally left out some tests that would reveal potential
        vulnerabilities you'll need to identify, solve for, AND TEST FOR!

      - Failing to address these vulnerabilities will leave your contracts
        exposed to hacks, and will certainly result in extra points being
        added to your micro-audit report! (Extra points are _bad_.)

  Your job (in this file):

    - DO NOT delete or change the test names for the tests provided
    - DO complete the testing logic inside each tests' callback function
    - DO add additional tests to test how you're securing your smart contracts
         against potential vulnerabilties you identify as you work through the
         project.

    - You will also find several places where "FILL_ME_IN" has been left for
      you. In those places, delete the "FILL_ME_IN" text, and replace with
      whatever is appropriate.
*/
// ----------------------------------------------------------------------------

import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish } from "ethers";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Project, ProjectFactory, ReverterTest } from "../typechain-types";

// ----------------------------------------------------------------------------
// OPTIONAL: Constants and Helper Functions
// ----------------------------------------------------------------------------
// We've put these here for your convenience, and to make you aware these built-in
// Hardhat functions exist. Feel free to use them if they are helpful!
const SECONDS_IN_DAY: number = 60 * 60 * 24;
const ONE_ETHER: BigNumber = ethers.utils.parseEther("1");

// Bump the timestamp by a specific amount of seconds
const timeTravel = async (seconds: number) => {
  await time.increase(seconds);
};

// Or, set the time to be a specific amount (in seconds past epoch time)
const timeTravelTo = async (seconds: number) => {
  await time.increaseTo(seconds);
};

// Compare two BigNumbers that are close to one another.
//
// This is useful for when you want to compare the balance of an address after
// it executes a transaction, and you don't want to worry about accounting for
// balances changes due to paying for gas a.k.a. transaction fees.
const closeTo = async (a: BigNumberish, b: BigNumberish, margin: number) => {
  expect(a).to.be.closeTo(b, margin);
};
// ----------------------------------------------------------------------------

describe("Crowdfundr", () => {
  // See the Hardhat docs on fixture for why we're using them:
  // https://hardhat.org/hardhat-network-helpers/docs/reference#fixtures
  // In particular, they allow you to run your tests in parallel using
  // `npx hardhat test --parallel` without the error-prone side-effects
  // that come from using mocha's `beforeEach`
  async function setupFixture() {
    const [deployer, alice, bob]: SignerWithAddress[] = await ethers.getSigners();

    // NOTE: You may need to pass arguments to the `deploy` function if your
    //       ProjectFactory contract's constructor has input parameters
    const ProjectFactory = await ethers.getContractFactory("ProjectFactory");
    const projectFactory: ProjectFactory = (await ProjectFactory.deploy()) as ProjectFactory;
    await projectFactory.deployed();

    // TODO: Your ProjectFactory contract will need a `create` method, to
    //       create new Projects
    const txReceiptUnresolved = await projectFactory.create("test", "TST", ethers.utils.parseEther("10"));
    const txReceipt = await txReceiptUnresolved.wait();

    const projectAddress = txReceipt.events![0].args![0];
    const project: Project = (await ethers.getContractAt("Project", projectAddress)) as Project;

    return { projectFactory, deployer, alice, bob, project, projectAddress };
  }

  describe("ProjectFactory: Additional Tests", () => {
    /* 
      TODO: You may add additional tests here if you need to

      NOTE: If you wind up writing Solidity code to protect against a
            vulnerability that is not tested for below, you should add
            at least one test here.

      DO NOT: Delete or change the test names for the tests provided below
    */
    it("Fail to refund a user", async () => {
      const { projectFactory } = await loadFixture(setupFixture);
      const ReverterTest = await ethers.getContractFactory("ReverterTest");
      const reverterTest: ReverterTest = (await ReverterTest.deploy()) as ReverterTest;
      await reverterTest.deployed();

      await reverterTest.create(projectFactory.address);

      await reverterTest.contribute({
        value: ethers.utils.parseEther("0.5"),
      });

      await timeTravel(SECONDS_IN_DAY * 30);
      await expect(reverterTest.refund()).to.be.revertedWith("Project: refund failed");
    });

    it("Fail to collect contributions for a complete project", async () => {
      const { projectFactory } = await loadFixture(setupFixture);
      const ReverterTest = await ethers.getContractFactory("ReverterTest");
      const reverterTest: ReverterTest = (await ReverterTest.deploy()) as ReverterTest;
      await reverterTest.deployed();

      await reverterTest.create(projectFactory.address);
      await reverterTest.contribute({
        value: ONE_ETHER,
      });

      await expect(reverterTest.withdrawFunds()).to.be.revertedWith("Project: withdraw failed");
    });
  });

  describe("ProjectFactory", () => {
    it("Deploys a contract", async () => {
      const { projectFactory, project, deployer } = await loadFixture(setupFixture);
      expect(projectFactory.address).to.not.be.undefined;
      expect(project.address).to.not.be.undefined;
      expect(await project.owner()).to.be.equal(deployer.address);
    });

    it("Can register a single project", async () => {
      const { projectFactory } = await loadFixture(setupFixture);
      //first projects is created in the fixture
      expect(await projectFactory.projects(0)).to.exist;
    });

    it("Can register multiple projects", async () => {
      const { projectFactory, alice, bob } = await loadFixture(setupFixture);
      await projectFactory.connect(alice).create("test2", "TST", ethers.utils.parseEther("5"));
      await projectFactory.connect(bob).create("test3", "TST", ethers.utils.parseEther("8.5"));

      // three projects should exists since the first one is created in the fixture
      expect(await projectFactory.projects(0)).to.exist;
      expect(await projectFactory.projects(1)).to.exist;
      expect(await projectFactory.projects(2)).to.exist;
    });

    it("Registers projects with the correct owner", async () => {
      const { projectFactory, alice } = await loadFixture(setupFixture);
      await projectFactory.connect(alice).create("test2", "TST", ethers.utils.parseEther("5"));
      const project: Project = (await ethers.getContractAt("Project", await projectFactory.projects(1))) as Project;
      expect(await project.owner()).equal(alice.address);
    });

    it("Registers projects with a preset funding goal (in units of wei)", async () => {
      const { projectFactory, alice } = await loadFixture(setupFixture);
      await projectFactory.connect(alice).create("test2", "TST", ethers.utils.parseEther("5"));
      const project: Project = (await ethers.getContractAt("Project", await projectFactory.projects(1))) as Project;
      expect(await project.goal()).equal(ethers.utils.parseEther("5"));
    });

    it('Emits a "ProjectCreated" event after registering a project', async () => {
      const { projectFactory, alice } = await loadFixture(setupFixture);
      const newProjectTxn = await projectFactory.connect(alice).create("Test2", "TEST", ethers.utils.parseEther("10"));
      const block = (await ethers.provider.getBlock("latest")).timestamp;

      await expect(newProjectTxn)
        .to.emit(projectFactory, "ProjectCreated")
        .withArgs(await projectFactory.projects(1), ethers.utils.parseEther("10"), block + SECONDS_IN_DAY * 30);
    });

    it("Allows multiple contracts to accept ETH simultaneously", async () => {
      const { projectFactory, project, projectAddress, alice, bob } = await loadFixture(setupFixture);
      await projectFactory.connect(alice).create("test2", "TST", ethers.utils.parseEther("5"));
      await projectFactory.connect(bob).create("test2", "TST", ethers.utils.parseEther("5"));

      const projectAddress2 = await projectFactory.projects(1);
      const project2: Project = (await ethers.getContractAt("Project", projectAddress2)) as Project;

      const projectAddress3 = await projectFactory.projects(2);
      const project3: Project = (await ethers.getContractAt("Project", projectAddress3)) as Project;

      await Promise.all([
        project.connect(alice).contribute({ value: ONE_ETHER }),
        project2.connect(bob).contribute({ value: ethers.utils.parseEther("0.5") }),
        project3.connect(alice).contribute({ value: ethers.utils.parseEther("0.25") }),
      ]);

      expect(await project.provider.getBalance(projectAddress)).to.be.equal(ONE_ETHER);
      expect(await project.provider.getBalance(projectAddress2)).to.be.equal(ethers.utils.parseEther("0.5"));
      expect(await project.provider.getBalance(projectAddress3)).to.be.equal(ethers.utils.parseEther("0.25"));
    });
  });

  describe("Project: Additional Tests", () => {
    /* 
      TODO: You may add additional tests here if you need to

      NOTE: If you wind up protecting against a vulnerability that is not
            tested for below, you should add at least one test here.

      DO NOT: Delete or change the test names for the tests provided below
    */
    it("Prevents creator to cancel a funded (complete) project", async () => {
      const { project, alice } = await loadFixture(setupFixture);
      await project.connect(alice).contribute({
        value: ethers.utils.parseEther("15"),
      });

      await expect(project.cancel()).to.be.revertedWith("Project: goal reached");
    });

    it("Prevents contributors from being refunded if a project is complete", async () => {
      const { project, projectAddress, alice } = await loadFixture(setupFixture);
      await project.connect(alice).contribute({
        value: ethers.utils.parseEther("15"),
      });

      await expect(project.connect(alice).refund()).to.be.revertedWith("Project: goal reached");
    });

    it("Prevents creator to withdraw funds for a cancelled project", async () => {
      const { project, alice } = await loadFixture(setupFixture);
      await project.connect(alice).contribute({
        value: ONE_ETHER,
      });
      await project.cancel();
      await expect(project.withdrawFunds(ONE_ETHER)).to.be.revertedWith("Project: cancelled");
    });

    it("Prevents contributors from being refunded if a project is complete", async () => {
      const { project, alice } = await loadFixture(setupFixture);
      await project.connect(alice).contribute({
        value: ethers.utils.parseEther("15"),
      });

      await expect(project.withdrawFunds(0)).to.be.revertedWith("Project: amount must > 0");
    });

    it("Prevents any EOA or creator to contribute to a cancelled project", async () => {
      const { project, projectAddress, alice, deployer } = await loadFixture(setupFixture);
      await project.cancel();
      await expect(
        project.connect(alice).contribute({
          value: ONE_ETHER,
        })
      ).to.be.revertedWith("Project: cancelled");
      await expect(
        project.contribute({
          value: ONE_ETHER,
        })
      ).to.be.revertedWith("Project: cancelled");
    });

    it("Prevents non owner of a badge to trade it to another user", async () => {
      const { project, projectAddress, alice, bob, deployer } = await loadFixture(setupFixture);
      await project.connect(alice).contribute({
        value: ONE_ETHER,
      });

      await project.connect(alice).mintBadges();
      expect(await project.balanceOf(alice.address)).to.be.equal(1);
      await expect(project.connect(bob).tradeBadge(deployer.address, 0)).to.be.revertedWith("Not the owner");
    });

    it("Prevents contributors from being refunded if a project is not cancelled", async () => {
      const { project, projectAddress, alice } = await loadFixture(setupFixture);
      await project.connect(alice).contribute({
        value: ethers.utils.parseEther("1"),
      });

      await expect(project.connect(alice).refund()).to.be.revertedWith("Project: not cancelled or not expired");
    });

    it("Prevents the creator from canceling the project if it's already cancelled", async () => {
      const { project } = await loadFixture(setupFixture);
      expect(await project.isCancelled()).to.be.false;
      await project.cancel();
      expect(await project.isCancelled()).to.be.true;
      await expect(project.cancel()).to.be.revertedWith("Project: cancelled");
    });

    it("Prevents EOA that are not creators from canceling the project", async () => {
      const { project, alice } = await loadFixture(setupFixture);
      expect(await project.isCancelled()).to.be.false;
      await expect(project.connect(alice).cancel()).to.be.revertedWith("Project: not creator");
    });
  });

  describe("Project", () => {
    describe("Contributions", () => {
      describe("Contributors", () => {
        it("Allows the creator to contribute", async () => {
          const { project, projectAddress, deployer } = await loadFixture(setupFixture);
          const deployerInitialBalance = await deployer.getBalance();
          await project.contribute({
            value: ONE_ETHER,
          });
          const deployerFinalBalance = await deployer.getBalance();
          const diff = deployerFinalBalance.sub(deployerInitialBalance);
          expect(await project.provider.getBalance(projectAddress)).to.be.equal(ONE_ETHER);
          closeTo(diff, ONE_ETHER, ethers.utils.parseEther("0.005").toNumber());
        });

        it("Allows any EOA to contribute", async () => {
          const { project, projectAddress, alice } = await loadFixture(setupFixture);

          const deployerInitialBalance = await alice.getBalance();
          await project.connect(alice).contribute({
            value: ONE_ETHER,
          });

          const deployerFinalBalance = await alice.getBalance();
          const diff = deployerFinalBalance.sub(deployerInitialBalance);
          expect(await project.provider.getBalance(projectAddress)).to.be.equal(ONE_ETHER);
          closeTo(diff, ONE_ETHER, ethers.utils.parseEther("0.005").toNumber());
        });

        it("Allows an EOA to make many separate contributions", async () => {
          const { project, projectAddress, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ONE_ETHER,
          });

          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("0.5"),
          });

          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("0.6"),
          });
          const fundsRaised = await project.fundsRaised();

          expect(fundsRaised).to.be.equal(ethers.utils.parseEther("2.1"));
        });

        it('Emits a "Contribution" event after a contribution is made', async () => {
          const { project, projectAddress, alice } = await loadFixture(setupFixture);

          const contributeTxn = await project.connect(alice).contribute({
            value: ONE_ETHER,
          });

          await contributeTxn.wait();
          await expect(contributeTxn)
            .to.emit(project, "Contribution")
            .withArgs(alice.address, project.address, ONE_ETHER);
        });
      });

      describe("Minimum ETH Per Contribution", () => {
        it("Reverts contributions below 0.01 ETH", async () => {
          const { project, projectAddress, alice } = await loadFixture(setupFixture);

          await expect(
            project.connect(alice).contribute({
              value: ethers.utils.parseEther("0.0001"),
            })
          ).to.be.revertedWith("Project: min 0.01 ether");
        });

        it("Accepts contributions of exactly 0.01 ETH", async () => {
          const { project, projectAddress, alice } = await loadFixture(setupFixture);

          await expect(
            project.connect(alice).contribute({
              value: ethers.utils.parseEther("0.01"),
            })
          ).not.to.be.revertedWith("Project: min 0.01 ether");

          closeTo(
            await alice.getBalance(),
            ethers.utils.parseEther("0.99"),
            ethers.utils.parseEther("0.001").toNumber()
          );
        });
      });

      describe("Final Contributions", () => {
        it("Allows the final contribution to exceed the project funding goal", async () => {
          // Note: After this contribution, the project is fully funded and should not
          //       accept any additional contributions. (See next test.)
          const { project, projectAddress, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("5"),
          });

          expect(await project.fundsRaised()).to.be.equal(ethers.utils.parseEther("5"));
          expect(await project.isComplete()).to.be.false;

          await project.connect(bob).contribute({
            value: ethers.utils.parseEther("6"),
          });

          expect(await project.fundsRaised()).to.be.equal(ethers.utils.parseEther("11"));
          expect(await project.isComplete()).to.be.true;
        });

        it("Prevents additional contributions after a project is fully funded", async () => {
          const { project, projectAddress, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("5"),
          });

          expect(await project.fundsRaised()).to.be.equal(ethers.utils.parseEther("5"));
          expect(await project.isComplete()).to.be.false;

          await project.connect(bob).contribute({
            value: ethers.utils.parseEther("6"),
          });

          expect(await project.fundsRaised()).to.be.equal(ethers.utils.parseEther("11"));
          expect(await project.isComplete()).to.be.true;

          await expect(
            project.connect(alice).contribute({
              value: ONE_ETHER,
            })
          ).to.be.revertedWith("Project: goal reached");
        });

        it("Prevents additional contributions after 30 days have passed since Project instance deployment", async () => {
          const { project, projectAddress, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("5"),
          });

          await timeTravel(SECONDS_IN_DAY * 15);

          expect(await project.fundsRaised()).to.be.equal(ethers.utils.parseEther("5"));
          expect(await project.isComplete()).to.be.false;

          await expect(
            project.connect(bob).contribute({
              value: ethers.utils.parseEther("3"),
            })
          ).not.to.be.revertedWith("Project: expired");

          expect(await project.fundsRaised()).to.be.equal(ethers.utils.parseEther("8"));
          expect(await project.isComplete()).to.be.false;

          await timeTravel(SECONDS_IN_DAY * 15);

          await expect(
            project.connect(alice).contribute({
              value: ONE_ETHER,
            })
          ).to.be.revertedWith("Project: expired");
        });
      });
    });

    describe("Withdrawals", () => {
      describe("Project Status: Active", () => {
        it("Prevents the creator from withdrawing any funds", async () => {
          const { project } = await loadFixture(setupFixture);
          await expect(project.withdrawFunds(ONE_ETHER)).to.be.revertedWith("Project: project failed!");
        });

        it("Prevents contributors from withdrawing any funds", async () => {
          const { project, alice } = await loadFixture(setupFixture);
          await expect(project.connect(alice).withdrawFunds(ONE_ETHER)).to.be.revertedWith("Project: not creator");
        });

        it("Prevents non-contributors from withdrawing any funds", async () => {
          const { project, projectAddress, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ONE_ETHER,
          });
          await expect(project.connect(bob).withdrawFunds(ONE_ETHER)).to.be.revertedWith("Project: not creator");
        });
      });

      describe("Project Status: Success", () => {
        it("Allows the creator to withdraw some of the contribution balance", async () => {
          const { project, projectAddress, deployer, alice } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("50"),
          });

          const deployerInitialBalance = await deployer.getBalance();
          await project.withdrawFunds(ONE_ETHER);
          const deployerFinalBalance = await deployer.getBalance();
          const diff = deployerFinalBalance.sub(deployerInitialBalance);

          expect(await project.provider.getBalance(projectAddress)).to.be.equal(ethers.utils.parseEther("49"));
          closeTo(diff, ONE_ETHER, ethers.utils.parseEther("0.005").toNumber());
        });

        it("Allows the creator to withdraw the entire contribution balance", async () => {
          const { project, projectAddress, deployer, alice } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("50"),
          });

          const deployerInitialBalance = await deployer.getBalance();
          await project.withdrawFunds(ethers.utils.parseEther("50"));
          const deployerFinalBalance = await deployer.getBalance();
          const diff = deployerFinalBalance.sub(deployerInitialBalance);

          expect(await project.provider.getBalance(projectAddress)).to.be.equal(ethers.utils.parseEther("0"));
          closeTo(diff, ethers.utils.parseEther("50"), ethers.utils.parseEther("0.005").toNumber());
        });

        it("Allows the creator to make multiple withdrawals", async () => {
          const { project, projectAddress, deployer, alice } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("50"),
          });

          let deployerInitialBalance = await deployer.getBalance();
          await project.withdrawFunds(ONE_ETHER);
          let deployerFinalBalance = await deployer.getBalance();
          let diff = deployerFinalBalance.sub(deployerInitialBalance);

          expect(await project.provider.getBalance(projectAddress)).to.be.equal(ethers.utils.parseEther("49"));
          closeTo(diff, ONE_ETHER, ethers.utils.parseEther("0.005").toNumber());

          deployerInitialBalance = await deployer.getBalance();
          await project.withdrawFunds(ONE_ETHER);
          deployerFinalBalance = await deployer.getBalance();
          diff = deployerFinalBalance.sub(deployerInitialBalance);

          expect(await project.provider.getBalance(projectAddress)).to.be.equal(ethers.utils.parseEther("48"));
          closeTo(diff, ONE_ETHER, ethers.utils.parseEther("0.005").toNumber());

          deployerInitialBalance = await deployer.getBalance();
          await project.withdrawFunds(ethers.utils.parseEther("5"));
          deployerFinalBalance = await deployer.getBalance();
          diff = deployerFinalBalance.sub(deployerInitialBalance);

          expect(await project.provider.getBalance(projectAddress)).to.be.equal(ethers.utils.parseEther("43"));
          closeTo(diff, ethers.utils.parseEther("5"), ethers.utils.parseEther("0.005").toNumber());
        });

        it("Prevents the creator from withdrawing more than the contribution balance", async () => {
          const { project, projectAddress, alice } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("50"),
          });

          await expect(project.withdrawFunds(ethers.utils.parseEther("100"))).to.be.revertedWith(
            "Project: not enough balance"
          );
        });

        it('Emits a "Withdraw" event after a withdrawal is made by the creator', async () => {
          const { project, projectAddress, alice, deployer } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("10"),
          });

          const contributeTxn = await project.withdrawFunds(ONE_ETHER);

          await contributeTxn.wait();
          await expect(contributeTxn)
            .to.emit(project, "Withdraw")
            .withArgs(deployer.address, project.address, ONE_ETHER);
        });

        it("Prevents contributors from withdrawing any funds", async () => {
          const { project, projectAddress, alice } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("10"),
          });

          await expect(project.connect(alice).withdrawFunds(ONE_ETHER)).to.be.revertedWith("Project: not creator");
        });

        it("Prevents non-contributors from withdrawing any funds", async () => {
          const { project, projectAddress, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ethers.utils.parseEther("10"),
          });

          await expect(project.connect(bob).withdrawFunds(ONE_ETHER)).to.be.revertedWith("Project: not creator");
        });
      });

      describe("Project Status: Failure", () => {
        it("Prevents the creator from withdrawing any funds (if not a contributor)", async () => {
          const { project, projectAddress, alice } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ONE_ETHER,
          });
          await timeTravel(SECONDS_IN_DAY * 31);
          await expect(project.withdrawFunds(ONE_ETHER)).to.be.revertedWith("Project: project failed!");
        });

        it("Prevents contributors from withdrawing any funds (though they can still refund)", async () => {
          const { project, projectAddress, alice } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ONE_ETHER,
          });
          await timeTravel(SECONDS_IN_DAY * 31);
          await expect(project.connect(alice).withdrawFunds(ONE_ETHER)).to.be.revertedWith("Project: not creator");

          await expect(project.connect(alice).refund()).not.to.be.reverted;
        });

        it("Prevents non-contributors from withdrawing any funds", async () => {
          const { project, projectAddress, alice, bob } = await loadFixture(setupFixture);
          await project.connect(alice).contribute({
            value: ONE_ETHER,
          });
          await timeTravel(SECONDS_IN_DAY * 31);
          await expect(project.connect(bob).withdrawFunds(ONE_ETHER)).to.be.revertedWith("Project: not creator");

          await expect(project.connect(bob).refund()).to.be.revertedWith("Project: no contribution");
        });
      });
    });

    describe("Refunds", () => {
      it("Allows contributors to be refunded when a project fails", async () => {
        const { project, projectAddress, alice } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await expect(project.connect(alice).refund()).to.be.revertedWith("Project: not cancelled or not expired");

        await timeTravel(SECONDS_IN_DAY * 31);

        let deployerInitialBalance = await alice.getBalance();
        await expect(project.connect(alice).refund()).not.to.be.reverted;
        let deployerFinalBalance = await alice.getBalance();
        let diff = deployerFinalBalance.sub(deployerInitialBalance);
        closeTo(diff, ONE_ETHER, ethers.utils.parseEther("0.005").toNumber());
      });

      it("Prevents contributors from being refunded if a project has not failed", async () => {
        const { project, projectAddress, alice } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await expect(project.connect(alice).refund()).to.be.revertedWith("Project: not cancelled or not expired");
      });

      it('Emits a "Refund" event after a a contributor receives a refund', async () => {
        const { project, projectAddress, alice } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await timeTravel(SECONDS_IN_DAY * 31);

        const refundTxn = await project.connect(alice).refund();
        await refundTxn.wait();
        await expect(refundTxn).to.emit(project, "Refund").withArgs(alice.address, project.address, ONE_ETHER);
      });
    });

    describe("Cancelations (creator-triggered project failures)", () => {
      it("Allows the creator to cancel the project if < 30 days since deployment has passed ", async () => {
        const { project } = await loadFixture(setupFixture);
        expect(await project.isCancelled()).to.be.false;
        await timeTravel(SECONDS_IN_DAY * 15);
        await project.cancel();
        expect(await project.isCancelled()).to.be.true;
      });

      it("Prevents the creator from canceling the project if at least 30 days have passed", async () => {
        const { project } = await loadFixture(setupFixture);
        expect(await project.isCancelled()).to.be.false;
        await timeTravel(SECONDS_IN_DAY * 30);
        await expect(project.cancel()).to.be.revertedWith("Project: expired");
        expect(await project.isCancelled()).to.be.false;
      });

      it('Emits a "ProjectCancelled" event after a project is cancelled by the creator', async () => {
        const { project } = await loadFixture(setupFixture);

        expect(await project.isCancelled()).to.be.false;
        const refundTxn = await project.cancel();
        await refundTxn.wait();

        expect(await project.isCancelled()).to.be.true;
        await expect(refundTxn).to.emit(project, "ProjectCancelled").withArgs(project.address);
      });
    });

    describe("NFT Contributor Badges", () => {
      it("Awards a contributor with a badge when they make a single contribution of at least 1 ETH", async () => {
        const { project, projectAddress, alice } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await project.connect(alice).mintBadges();
        expect(await project.balanceOf(alice.address)).to.be.equal(1);
      });

      it("Awards a contributor with a badge when they make multiple contributions to a single project that sum to at least 1 ETH", async () => {
        const { project, projectAddress, alice } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ethers.utils.parseEther("0.25"),
        });

        await expect(project.connect(alice).mintBadges()).to.be.reverted;

        await project.connect(alice).contribute({
          value: ethers.utils.parseEther("0.5"),
        });

        await expect(project.connect(alice).mintBadges()).to.be.reverted;

        await project.connect(alice).contribute({
          value: ethers.utils.parseEther("0.25"),
        });
        await project.connect(alice).mintBadges();
        expect(await project.balanceOf(alice.address)).to.be.equal(1);
      });

      it("Does not award a contributor with a badge if their total contribution to a single project sums to < 1 ETH", async () => {
        const { project, projectAddress, alice } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ethers.utils.parseEther("0.5"),
        });
        await expect(project.connect(alice).mintBadges()).to.be.reverted;
      });

      it("Awards a contributor with a second badge when their total contribution to a single project sums to at least 2 ETH", async () => {
        // Note: One address can receive multiple badges for a single project,
        //       but they should only receive 1 badge per 1 ETH contributed.
        const { project, projectAddress, alice } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await project.connect(alice).mintBadges();
        expect(await project.balanceOf(alice.address)).to.be.equal(1);

        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await project.connect(alice).mintBadges();
        expect(await project.balanceOf(alice.address)).to.be.equal(2);
      });

      it("Does not award a contributor with a second badge if their total contribution to a single project is > 1 ETH but < 2 ETH", async () => {
        const { project, projectAddress, alice } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await project.connect(alice).mintBadges();
        expect(await project.balanceOf(alice.address)).to.be.equal(1);

        await project.connect(alice).contribute({
          value: ethers.utils.parseEther("0.5"),
        });

        await expect(project.connect(alice).mintBadges()).to.be.reverted;
      });

      it("Awards contributors with different NFTs for contributions to different projects", async () => {
        const { projectFactory, project, projectAddress, alice } = await loadFixture(setupFixture);
        await projectFactory.connect(alice).create("test2", "TST", ethers.utils.parseEther("5"));
        const projectAddress2 = await projectFactory.projects(1);
        const project2: Project = (await ethers.getContractAt("Project", projectAddress2)) as Project;

        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await project2.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await project.connect(alice).mintBadges();
        await project2.connect(alice).mintBadges();

        expect(await project.balanceOf(alice.address)).to.be.equal(1);
        expect(await project2.balanceOf(alice.address)).to.be.equal(1);
      });

      it("Allows contributor badge holders to trade the NFT to another address", async () => {
        const { project, projectAddress, alice, bob } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await project.connect(alice).mintBadges();
        expect(await project.balanceOf(alice.address)).to.be.equal(1);
        expect(await project.balanceOf(bob.address)).to.be.equal(0);

        await project.connect(alice).tradeBadge(bob.address, 0);

        expect(await project.balanceOf(alice.address)).to.be.equal(0);
        expect(await project.balanceOf(bob.address)).to.be.equal(1);
      });

      it("Allows contributor badge holders to trade the NFT to another address even after its related project fails", async () => {
        const { project, projectAddress, alice } = await loadFixture(setupFixture);
        await project.connect(alice).contribute({
          value: ONE_ETHER,
        });

        await timeTravel(SECONDS_IN_DAY * 30);
        await project.connect(alice).mintBadges();
        expect(await project.balanceOf(alice.address)).to.be.equal(1);
      });
    });
  });
});
