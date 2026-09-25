import { expect } from "chai";
import { network } from "hardhat";

describe("DatasetMarketplace", function () {
  it("should register a dataset", async function () {
    const { ethers } = await network.connect();

    const marketplace = await ethers.deployContract("DatasetMarketplace");
    await marketplace.waitForDeployment();

    const [seller] = await ethers.getSigners();

    await marketplace.registerDataset(
      "Student Dataset",
      "Sample student dataset for testing",
      "QmExampleIPFSCID123",
      "abc123sha256hash",
      ethers.parseEther("1")
    );

    const dataset = await marketplace.getDataset(1);

    expect(dataset.id).to.equal(1n);
    expect(dataset.seller).to.equal(seller.address);
    expect(dataset.name).to.equal("Student Dataset");
    expect(dataset.ipfsCID).to.equal("QmExampleIPFSCID123");
    expect(dataset.dataHash).to.equal("abc123sha256hash");
    expect(dataset.price).to.equal(ethers.parseEther("1"));
    expect(dataset.active).to.equal(true);
  });
});
it("should allow a buyer to purchase a dataset", async function () {
  const { ethers } = await network.connect();

  const marketplace = await ethers.deployContract("DatasetMarketplace");
  await marketplace.waitForDeployment();

  const [seller, buyer] = await ethers.getSigners();

  const price = ethers.parseEther("1");

  // Seller registers the dataset
  await marketplace.connect(seller).registerDataset(
    "AI Training Dataset",
    "Dataset for AI model training",
    "QmAITrainingDataset123",
    "hash123",
    price
  );

  const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

  // Buyer purchases the dataset
  await marketplace.connect(buyer).purchaseDataset(1, {
    value: price
  });

  const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);

  // Seller should receive the dataset price
  expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(price);

  // Dataset should still be active
  const dataset = await marketplace.getDataset(1);
  expect(dataset.active).to.equal(true);
});