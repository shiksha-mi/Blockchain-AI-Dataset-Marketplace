import { useState } from 'react'
import { ethers } from 'ethers'
import DatasetMarketplace from './contracts/DatasetMarketplace.json'
import { CONTRACT_ADDRESS } from './contracts/contractConfig'
import './App.css'

function App() {
  const [account, setAccount] = useState('')
  const [contract, setContract] = useState(null)

  // Register Dataset
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ipfsCID, setIpfsCID] = useState('')
  const [dataHash, setDataHash] = useState('')
  const [price, setPrice] = useState('')

  // View one Dataset
  const [dataset, setDataset] = useState(null)
  const [datasetId, setDatasetId] = useState('1')

  // View all Datasets
  const [datasets, setDatasets] = useState([])

  // CONNECT WALLET
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask')
      return
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)

      const accounts = await provider.send('eth_requestAccounts', [])

      const signer = await provider.getSigner()

      const marketplace = new ethers.Contract(
        CONTRACT_ADDRESS,
        DatasetMarketplace.abi || DatasetMarketplace,
        signer
      )

      setAccount(accounts[0])
      setContract(marketplace)

      console.log('Wallet connected:', accounts[0])
      console.log('Contract connected:', CONTRACT_ADDRESS)

      alert('Wallet connected successfully!')
    } catch (error) {
      console.error(error)
      alert('Failed to connect wallet')
    }
  }

  // REGISTER DATASET
  const registerDataset = async () => {
    if (!contract) {
      alert('Please connect your wallet first')
      return
    }

    try {
      const priceInWei = ethers.parseEther(price)

      const tx = await contract.registerDataset(
        name,
        description,
        ipfsCID,
        dataHash,
        priceInWei
      )

      alert('Transaction submitted. Please wait...')

      await tx.wait()

      alert('Dataset registered successfully!')

      setName('')
      setDescription('')
      setIpfsCID('')
      setDataHash('')
      setPrice('')

      // Refresh dataset list after registration
      loadDatasets()
    } catch (error) {
      console.error(error)
      alert('Transaction failed')
    }
  }

  // VIEW ALL DATASETS
  const loadDatasets = async () => {
    if (!contract) {
      alert('Please connect your wallet first')
      return
    }

    try {
      const total = await contract.getTotalDatasets()

      const loadedDatasets = []

      for (let i = 1; i <= Number(total); i++) {
        const data = await contract.getDataset(i)

        loadedDatasets.push({
          id: data.id.toString(),
          name: data.name,
          description: data.description,
          ipfsCID: data.ipfsCID,
          dataHash: data.dataHash,
          price: ethers.formatEther(data.price),
          seller: data.seller,
          timestamp: new Date(
            Number(data.timestamp) * 1000
          ).toLocaleString(),
          active: data.active
        })
      }

      setDatasets(loadedDatasets)

      if (loadedDatasets.length === 0) {
        alert('No datasets found')
      }
    } catch (error) {
      console.error(error)
      alert('Failed to load datasets')
    }
  }

  // VIEW ONE DATASET
  const viewDataset = async () => {
    if (!contract) {
      alert('Please connect your wallet first')
      return
    }

    try {
      const data = await contract.getDataset(datasetId)

      setDataset({
        id: data.id.toString(),
        seller: data.seller,
        name: data.name,
        description: data.description,
        ipfsCID: data.ipfsCID,
        dataHash: data.dataHash,
        price: ethers.formatEther(data.price),
        timestamp: new Date(
          Number(data.timestamp) * 1000
        ).toLocaleString(),
        active: data.active
      })

      alert('Dataset loaded successfully!')
    } catch (error) {
      console.error(error)
      alert('Dataset not found')
    }
  }

  return (
    <div>
      <h1>Blockchain AI Dataset Marketplace</h1>

      {/* CONNECT WALLET */}
      <button onClick={connectWallet}>
        {account
          ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}`
          : 'Connect Wallet'}
      </button>

      {account && (
        <div>

          {/* ================= REGISTER DATASET ================= */}

          <h2>Register Dataset</h2>

          <input
            type="text"
            placeholder="Dataset Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <br />
          <br />

          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <br />
          <br />

          <input
            type="text"
            placeholder="IPFS CID"
            value={ipfsCID}
            onChange={(e) => setIpfsCID(e.target.value)}
          />

          <br />
          <br />

          <input
            type="text"
            placeholder="Data Hash"
            value={dataHash}
            onChange={(e) => setDataHash(e.target.value)}
          />

          <br />
          <br />

          <input
            type="text"
            placeholder="Price in ETH"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />

          <br />
          <br />

          <button onClick={registerDataset}>
            Register Dataset
          </button>

          <hr />

          {/* ================= VIEW ALL DATASETS ================= */}

          <h2>Available Datasets</h2>

          <button onClick={loadDatasets}>
            View Datasets
          </button>

          {datasets.length > 0 && (
            <div>
              {datasets.map((item) => (
                <div key={item.id}>
                  <h3>{item.name}</h3>

                  <p>
                    <strong>ID:</strong> {item.id}
                  </p>

                  <p>
                    <strong>Description:</strong> {item.description}
                  </p>

                  <p>
                    <strong>IPFS CID:</strong> {item.ipfsCID}
                  </p>

                  <p>
                    <strong>Data Hash:</strong> {item.dataHash}
                  </p>

                  <p>
                    <strong>Price:</strong> {item.price} ETH
                  </p>

                  <p>
                    <strong>Seller:</strong> {item.seller}
                  </p>

                  <p>
                    <strong>Registered:</strong> {item.timestamp}
                  </p>

                  <p>
                    <strong>Status:</strong>{' '}
                    {item.active ? 'Active' : 'Inactive'}
                  </p>

                  <hr />
                </div>
              ))}
            </div>
          )}

          {/* ================= VIEW ONE DATASET ================= */}

          <h2>View Dataset by ID</h2>

          <input
            type="number"
            min="1"
            placeholder="Dataset ID"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
          />

          <br />
          <br />

          <button onClick={viewDataset}>
            View Dataset
          </button>

          {dataset && (
            <div>
              <h2>Dataset Details</h2>

              <p>
                <strong>ID:</strong> {dataset.id}
              </p>

              <p>
                <strong>Name:</strong> {dataset.name}
              </p>

              <p>
                <strong>Description:</strong> {dataset.description}
              </p>

              <p>
                <strong>IPFS CID:</strong> {dataset.ipfsCID}
              </p>

              <p>
                <strong>Data Hash:</strong> {dataset.dataHash}
              </p>

              <p>
                <strong>Price:</strong> {dataset.price} ETH
              </p>

              <p>
                <strong>Seller:</strong> {dataset.seller}
              </p>

              <p>
                <strong>Registered:</strong> {dataset.timestamp}
              </p>

              <p>
                <strong>Status:</strong>{' '}
                {dataset.active ? 'Active' : 'Inactive'}
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

export default App