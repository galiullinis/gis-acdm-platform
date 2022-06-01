import hre from 'hardhat'


async function main() {
    await hre.run("verify:verify", {
        address: "0xdfdD09Cd79207FF7C65acF9288CE84190aDd06A0",
        constructorArguments: [
            "0x2df4B2126A50cA1ce574530a0203C6c44d388f81",
            "0x274c1b4970cBD646491E0F320851AA16D98065BC",
            30,
            259200
        ],
      });    
    await hre.run("verify:verify", {
    address: "0x42F6a322419aF73815Ba115593090EcC84519A26",
    constructorArguments: [
        "0xa3813758dCe6AC9D841355e07b1c42B930E9B79B",
        86400
    ],
    });   
    await hre.run("verify:verify", {
    address: "0xDc2c6121662f56c3Ff40e4b88563c665f649c473",
    constructorArguments: [
        "0x274c1b4970cBD646491E0F320851AA16D98065BC",
        "0x6ea1398939C5ce78370Bd64bCE233fe754a79A2e"
    ],
    });   
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });