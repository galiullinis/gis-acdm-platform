import hre from 'hardhat';
import "dotenv/config";

const ethers = hre.ethers

async function main() {
    const [signer] = await ethers.getSigners()
    const GisToken = await ethers.getContractFactory('GisToken', signer)
    
    const XXXToken = await GisToken.deploy("XXX Coin", "XXX", 18)
    await XXXToken.deployed()

    const ACDMToken = await GisToken.deploy("ACADEM Coin", "ACDM", 6)
    await ACDMToken.deployed()


    console.log("XXX: " + XXXToken.address)
    console.log("ACDM: " + ACDMToken.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });