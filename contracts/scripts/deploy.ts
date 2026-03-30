import hre from 'hardhat'

async function main() {
  const { ethers } = hre
  const [deployer] = await ethers.getSigners()
  console.log('Deploying EDIBadge with account:', deployer.address)

  const EDIBadge = await ethers.getContractFactory('EDIBadge')
  const contract = await EDIBadge.deploy(deployer.address)
  await contract.waitForDeployment()

  const address = await contract.getAddress()
  console.log('EDIBadge deployed to:', address)
  console.log('Add this to your .env.local:')
  const networkEnvVar =
    hre.network.name === 'polygon' ? 'POLYGON_MAINNET_CONTRACT' : 'POLYGON_AMOY_CONTRACT'
  console.log(`${networkEnvVar}=${address}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
