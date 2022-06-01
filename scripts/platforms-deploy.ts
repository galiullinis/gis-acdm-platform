import hre from 'hardhat';
import "dotenv/config";

const ethers = hre.ethers

// DAO params
const stakingTokenAddr = "0x274c1b4970cBD646491E0F320851AA16D98065BC"
const minimumQuorumPercent = 30
const debatingPeriodDuration = 60 * 60 * 24 * 3
// ACDM Platform params
const ACDMToken = "0xa3813758dCe6AC9D841355e07b1c42B930E9B79B"
const roundTime = 60 * 60 * 24
// Staking contract params
const rewardTokenAddr = "0x6ea1398939C5ce78370Bd64bCE233fe754a79A2e"

async function main() {
    const [signer] = await ethers.getSigners()
    const chairmanAddr = signer.address

    const GisDAOVoting = await ethers.getContractFactory('GisDAOVoting', signer)
    const ACDMPlatform = await ethers.getContractFactory('ACDMPlatform', signer)
    const GisStaking = await ethers.getContractFactory('GisStaking', signer)
    
    const gisDaoVoting = await GisDAOVoting.deploy(chairmanAddr, stakingTokenAddr, minimumQuorumPercent, debatingPeriodDuration)
    const acdmPlatform = await ACDMPlatform.deploy(ACDMToken, roundTime)
    const gisStaking = await GisStaking.deploy(stakingTokenAddr, rewardTokenAddr)

    await gisDaoVoting.deployed()
    await acdmPlatform.deployed()
    await gisStaking.deployed()

    console.log("DAO: " + gisDaoVoting.address)
    console.log("ACDMPlatform: " + acdmPlatform.address)
    console.log("StakingPlatform: " + gisStaking.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });