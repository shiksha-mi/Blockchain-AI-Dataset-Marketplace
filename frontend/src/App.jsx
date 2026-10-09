
import { useState } from 'react'
import { ethers } from 'ethers'
import DatasetMarketplace from './contracts/DatasetMarketplace.json'
import { CONTRACT_ADDRESS } from './contracts/contractConfig'
import './App.css'

const API_URL = 'http://127.0.0.1:8000'

function App() {
  const [account, setAccount] = useState('')
  const [contract, setContract] = useState(null)

  // Register Dataset
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ipfsCID, setIpfsCID] = useState('')
  const [dataHash, setDataHash] = useState('')
  const [price, setPrice] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [message, setMessage] = useState('')

  // View one Dataset
  const [dataset, setDataset] = useState(null)
  const [datasetId, setDatasetId] = useState('1')

  // View all Datasets
  const [datasets, setDatasets] = useState([])
  const [loadingDatasets, setLoadingDatasets] = useState(false)

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
      setMessage('Wallet connected successfully.')

      console.log('Wallet connected:', accounts[0])
      console.log('Contract connected:', CONTRACT_ADDRESS)
    } catch (error) {
      console.error('Wallet connection error:', error)
      alert(error.shortMessage || error.message || 'Failed to connect wallet')
    }
  }

  // UPLOAD CSV TO FASTAPI AND IPFS
  const uploadDatasetToIPFS = async () => {
    if (!selectedFile) {
      alert('Please select a CSV file first.')
      return
    }

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      alert('Only CSV files are supported.')
      return
    }

    try {
      setUploading(true)
      setMessage('Uploading and analyzing CSV...')

      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`${API_URL}/upload-ipfs`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok || !result.success || !result.ipfs?.success) {
        throw new Error(
          result.error ||
          result.ipfs?.error ||
          'Dataset upload failed.'
        )
      }

      setIpfsCID(result.ipfs.ipfs_hash)
      setDataHash(result.dataset_hash)
      setMessage('CSV uploaded successfully. IPFS CID and hash are ready.')

      alert('Upload successful! IPFS CID and Data Hash have been filled in.')
    } catch (error) {
      console.error('Dataset upload error:', error)
      setMessage(`Upload failed: ${error.message}`)
      alert(
        error.message ||
        'Upload failed. Make sure the FastAPI backend is running.'
      )
    } finally {
      setUploading(false)
    }
  }

  // REGISTER DATASET ON BLOCKCHAIN
  const registerDataset = async () => {
    if (!contract) {
      alert('Please connect your wallet first.')
      return
    }

    if (!name.trim() || !description.trim()) {
      alert('Please enter a dataset name and description.')
      return
    }

    if (!ipfsCID.trim() || !dataHash.trim()) {
      alert('Please upload a CSV to IPFS first.')
      return
    }

    if (!price.trim() || !Number.isFinite(Number(price)) || Number(price) < 0) {
      alert('Please enter a valid price in ETH.')
      return
    }

    try {
      setRegistering(true)
      setMessage('Please confirm the transaction in MetaMask...')

      const priceInWei = ethers.parseEther(price)

      const tx = await contract.registerDataset(
        name.trim(),
        description.trim(),
        ipfsCID.trim(),
        dataHash.trim(),
        priceInWei
      )

      setMessage('Transaction submitted. Waiting for confirmation...')
      await tx.wait()

      setMessage('Dataset registered successfully on the blockchain!')
      alert('Dataset registered successfully!')

      setName('')
      setDescription('')
      setIpfsCID('')
      setDataHash('')
      setPrice('')
      setSelectedFile(null)

      const fileInput = document.getElementById('dataset-csv-file')
      if (fileInput) fileInput.value = ''

      await loadDatasets()
    } catch (error) {
      console.error('Registration error:', error)
      const errorMessage =
        error.reason ||
        error.shortMessage ||
        error.message ||
        'Transaction failed.'

      setMessage(`Registration failed: ${errorMessage}`)
      alert(`Transaction failed: ${errorMessage}`)
    } finally {
      setRegistering(false)
    }
  }

  // VIEW ALL DATASETS
  const loadDatasets = async () => {
    if (!contract) {
      alert('Please connect your wallet first.')
      return
    }

    try {
      setLoadingDatasets(true)

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
        setMessage('No datasets have been registered yet.')
      } else {
        setMessage(`Loaded ${loadedDatasets.length} dataset(s).`)
      }
    } catch (error) {
      console.error('Load datasets error:', error)
      alert(error.shortMessage || error.message || 'Failed to load datasets.')
    } finally {
      setLoadingDatasets(false)
    }
  }

  // VIEW ONE DATASET
  const viewDataset = async () => {
    if (!contract) {
      alert('Please connect your wallet first.')
      return
    }

    if (!datasetId || Number(datasetId) < 1) {
      alert('Enter a valid dataset ID.')
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

      setMessage('Dataset details loaded.')
    } catch (error) {
      console.error('View dataset error:', error)
      setDataset(null)
      alert(error.shortMessage || error.message || 'Dataset not found.')
    }
  }

  // OPEN DATASET STORED ON IPFS
  const openIPFS = (cid) => {
    if (!cid) return
    window.open(
      `https://gateway.pinata.cloud/ipfs/${encodeURIComponent(cid)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <div>
      <h1>Blockchain AI Dataset Marketplace</h1>

      <button onClick={connectWallet}>
        {account
          ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}`
          : 'Connect Wallet'}
      </button>

      {message && <p role="status">{message}</p>}

      {account && (
        <div>
          <h2>Register Dataset</h2>

          <p>Select a CSV file to upload it to the backend and Pinata IPFS.</p>

          <input
            id="dataset-csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />

          <br />
          <br />

          <button onClick={uploadDatasetToIPFS} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload CSV to IPFS'}
          </button>

          <br />
          <br />

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
            placeholder="IPFS CID (filled after upload)"
            value={ipfsCID}
            onChange={(e) => setIpfsCID(e.target.value)}
          />

          <br />
          <br />

          <input
            type="text"
            placeholder="Data Hash (filled after upload)"
            value={dataHash}
            onChange={(e) => setDataHash(e.target.value)}
          />

          <br />
          <br />

          <input
            type="number"
            min="0"
            step="any"
            placeholder="Price in ETH (e.g. 0.01)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />

          <br />
          <br />

          <button onClick={registerDataset} disabled={registering || uploading}>
            {registering ? 'Registering...' : 'Register Dataset on Blockchain'}
          </button>

          <hr />

          <h2>Available Datasets</h2>

          <button onClick={loadDatasets} disabled={loadingDatasets}>
            {loadingDatasets ? 'Loading...' : 'View Datasets'}
          </button>

          {datasets.length > 0 && (
            <div>
              {datasets.map((item) => (
                <div key={item.id}>
                  <h3>{item.name}</h3>
                  <p><strong>ID:</strong> {item.id}</p>
                  <p><strong>Description:</strong> {item.description}</p>
                  <p><strong>IPFS CID:</strong> {item.ipfsCID}</p>
                  <p><strong>Data Hash:</strong> {item.dataHash}</p>
                  <p><strong>Price:</strong> {item.price} ETH</p>
                  <p><strong>Seller:</strong> {item.seller}</p>
                  <p><strong>Registered:</strong> {item.timestamp}</p>
                  <p>
                    <strong>Status:</strong>{' '}
                    {item.active ? 'Active' : 'Inactive'}
                  </p>

                  <button onClick={() => openIPFS(item.ipfsCID)}>
                    Open Dataset on IPFS
                  </button>

                  <hr />
                </div>
              ))}
            </div>
          )}

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

          <button onClick={viewDataset}>View Dataset</button>

          {dataset && (
            <div>
              <h2>Dataset Details</h2>
              <p><strong>ID:</strong> {dataset.id}</p>
              <p><strong>Name:</strong> {dataset.name}</p>
              <p><strong>Description:</strong> {dataset.description}</p>
              <p><strong>IPFS CID:</strong> {dataset.ipfsCID}</p>
              <p><strong>Data Hash:</strong> {dataset.dataHash}</p>
              <p><strong>Price:</strong> {dataset.price} ETH</p>
              <p><strong>Seller:</strong> {dataset.seller}</p>
              <p><strong>Registered:</strong> {dataset.timestamp}</p>
              <p>
                <strong>Status:</strong>{' '}
                {dataset.active ? 'Active' : 'Inactive'}
              </p>

              <button onClick={() => openIPFS(dataset.ipfsCID)}>
                Open Dataset on IPFS
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
