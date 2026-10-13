
import { network } from "hardhat";

const { ethers } = await network.connect();

const address = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const code = await ethers.provider.getCode(address);

console.log("Contract address:", address);
console.log("Contract code:", code);
console.log("Contract deployed:", code !== "0x");
