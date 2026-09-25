import { network } from "hardhat";

const { ethers } = await network.connect();

const marketplace = await ethers.deployContract("DatasetMarketplace");

await marketplace.waitForDeployment();

console.log(
  "DatasetMarketplace deployed to:",
  await marketplace.getAddress()
);