import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import DatasetMarketplace from './contracts/DatasetMarketplace.json'
import { CONTRACT_ADDRESS } from './contracts/contractConfig'
import './App.css'

const API_URL = 'http://127.0.0.1:8000'

function App() {
  const [account, setAccount] = useState('')
  const [contract, setContract] = useState(null)
  const [activePage, setActivePage] = useState('Overview')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ipfsCID, setIpfsCID] = useState('')
  const [dataHash, setDataHash] = useState('')
  const [price, setPrice] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [message, setMessage] = useState('')
  const [dataset, setDataset] = useState(null)
  const [datasetId, setDatasetId] = useState('1')
  const [datasets, setDatasets] = useState([])
  const [purchasedDatasets, setPurchasedDatasets] = useState([])
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [aiTarget, setAiTarget] = useState('Marks')
  const [aiLoading, setAiLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [modelResult, setModelResult] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const [aiError, setAiError] = useState('')

  


const runAIRequest = async (endpoint, includeTarget = false) => {
  if (!dataset || !dataset.ipfsCID) {
    setAiError('Please load a registered dataset first.')
    return null
  }

  try {
    setAiLoading(true)
    setAiError('')

    const response = await fetch(
      `${API_URL}/analyze-ipfs/${dataset.ipfsCID}`
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.detail
          ? JSON.stringify(result.detail)
          : result.error || `Request failed (${response.status})`
      )
    }

    return result
  } catch (error) {
    setAiError(error.message || 'AI request failed.')
    return null
  } finally {
    setAiLoading(false)
  }
}




  const analyzeDataset = async () => {
    const result = await runAIRequest('analyze')
    if (result) setAnalysisResult(result)
  }
  const validateModel = async () => {
    const result = await runAIRequest('validate-model', true)
    if (result) setModelResult(result)
  }
  const verifyDataset = async () => {
    const result = await runAIRequest('verify-dataset', true)
    if (result) setVerificationResult(result)
  }

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask')
      return
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const signer = await provider.getSigner()
      const balance = await provider.getBalance(accounts[0])
      console.log('Connected account:', accounts[0])
      console.log('Network:', await provider.getNetwork())
      console.log('Wallet balance:', ethers.formatEther(balance), 'ETH')
       
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
  
const handleAccountsChanged = async (accounts) => {
  if (!accounts || accounts.length === 0) {
    setAccount('')
    setContract(null)
    setPurchasedDatasets([])
    setMessage('Please connect your MetaMask wallet.')
    return
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    const marketplace = new ethers.Contract(
      CONTRACT_ADDRESS,
      DatasetMarketplace.abi || DatasetMarketplace,
      signer
    )

    setAccount(accounts[0])
    setContract(marketplace)
    setPurchasedDatasets([])
    setMessage('Wallet account changed successfully.')

    // Load purchases for the newly selected account
    const filter = marketplace.filters.DatasetPurchased(null, accounts[0])
    const events = await marketplace.queryFilter(filter, 0, 'latest')
    const purchasedIds = [
      ...new Set(events.map(event => event.args.id.toString()))
    ]

    const loadedPurchases = []

    for (const id of purchasedIds) {
      const data = await marketplace.getDataset(id)

      loadedPurchases.push({
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

    setPurchasedDatasets(loadedPurchases)
  } catch (error) {
    console.error('Account change error:', error)
    setMessage('Could not load purchases for this wallet.')
  }
}

useEffect(() => {
  if (!window.ethereum) return

  const listener = (accounts) => {
    handleAccountsChanged(accounts)
  }

  window.ethereum.on('accountsChanged', listener)

  return () => {
    window.ethereum.removeListener('accountsChanged', listener)
  }
}, [])



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
          result.error || result.ipfs?.error || 'Dataset upload failed.'
        )
      }
      setIpfsCID(result.ipfs.ipfs_hash)
      setDataHash(result.dataset_hash)
      setMessage('CSV uploaded successfully. IPFS CID and hash are ready.')
      alert('Upload successful! IPFS CID and Data Hash have been filled in.')
    } catch (error) {
      console.error('Dataset upload error:', error)
      setMessage(`Upload failed: ${error.message}`)
      alert(error.message || 'Upload failed. Make sure the FastAPI backend is running.')
    } finally {
      setUploading(false)
    }
  }
  const loadPurchasedDatasets = async () => {
  if (!contract || !account) {
    setPurchasedDatasets([])
    return
  }

  try {
    const filter = contract.filters.DatasetPurchased(null, account)
    const events = await contract.queryFilter(filter, 0, 'latest')

    const purchasedIds = [
      ...new Set(events.map(event => event.args.id.toString()))
    ]

    const loadedPurchases = []

    for (const id of purchasedIds) {
      const data = await contract.getDataset(id)

      loadedPurchases.push({
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

    setPurchasedDatasets(loadedPurchases)
  } catch (error) {
    console.error('Load purchased datasets error:', error)
  }
}

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

const receipt = await tx.wait()

if (!receipt || receipt.status !== 1) {
  throw new Error('The blockchain transaction failed. The dataset was not registered.')
}

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
      const errorMessage = error.reason || error.shortMessage || error.message || 'Transaction failed.'
      setMessage(`Registration failed: ${errorMessage}`)
      alert(`Transaction failed: ${errorMessage}`)
    } finally {
      setRegistering(false)
    }
  }

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
          timestamp: new Date(Number(data.timestamp) * 1000).toLocaleString(),
          active: data.active
        })
      }
      setDatasets(loadedDatasets)
      await loadPurchasedDatasets()
      setMessage(
        loadedDatasets.length === 0
          ? 'No datasets have been registered yet.'
          : `Loaded ${loadedDatasets.length} dataset(s).`
      )
    } catch (error) {
      console.error('Load datasets error:', error)
      alert(error.shortMessage || error.message || 'Failed to load datasets.')
    } finally {
      setLoadingDatasets(false)
    }
  }

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
        timestamp: new Date(Number(data.timestamp) * 1000).toLocaleString(),
        active: data.active
      })
      setMessage('Dataset details loaded.')
    } catch (error) {
      console.error('View dataset error:', error)
      setDataset(null)
      alert(error.shortMessage || error.message || 'Dataset not found.')
    }
  }

  


const purchaseDataset = async (id, priceInWei) => {
  console.log("Purchase clicked:", id, priceInWei.toString())

  try {
    if (!contract) {
      setMessage('Please connect MetaMask first.')
      return
    }

    const accounts = await window.ethereum.request({
      method: 'eth_accounts'
    })

    const buyerAddress = accounts[0]

    const signer = await contract.runner.getAddress()
console.log("MetaMask account:", buyerAddress)
console.log("Contract signer account:", signer)
console.log("Purchase dataset ID:", id)

    if (!buyerAddress) {
      setMessage('Please connect your MetaMask wallet.')
      return
    }

    const data = await contract.getDataset(id)
    const sellerAddress = data.seller

    if (buyerAddress.toLowerCase() === sellerAddress.toLowerCase()) {
      setMessage('⚠️ You cannot purchase your own dataset. Please connect a different wallet account.')
      return
    }

    setMessage('Please confirm the purchase in MetaMask...')

    const tx = await contract.purchaseDataset(id, {
      value: priceInWei
    })

    setMessage('Transaction submitted. Waiting for confirmation...')

    const receipt = await tx.wait()

    if (!receipt || Number(receipt.status) !== 1) {
      throw new Error('The blockchain transaction failed.')
    }

    setMessage('✅ Dataset purchased successfully!')

    // Refresh the dataset list separately so a refresh error
    // does not make a successful purchase appear to have failed.
    try {
      await loadDatasets()
    } catch (refreshError) {
      console.error('Dataset refresh failed:', refreshError)
    }

  } catch (error) {
  console.error('Purchase failed:', error)
  console.error('Error reason:', error?.reason)
  console.error('Error message:', error?.shortMessage || error?.message)
  console.error('Transaction hash:', error?.transaction?.hash)

  setMessage(
    `❌ Purchase failed: ${
      error?.reason ||
      error?.shortMessage ||
      error?.message ||
      'Purchase failed. Please try again.'
    }`
  )
}
}


  const openIPFS = (cid) => {
    if (!cid) return
    window.open(
      `https://gateway.pinata.cloud/ipfs/${encodeURIComponent(cid)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  
return (
  <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">D</div>
        <div>
          <h2>DataSet</h2>
          <span>AI Marketplace</span>
        </div>
      </div>

      <p className="nav-heading">WORKSPACE</p>

      <nav className="sidebar-nav">
        {[
          { name: 'Overview', icon: '◫' },
          { name: 'Marketplace', icon: '▦' },
          { name: 'Register Dataset', icon: '＋' },
          { name: 'AI Studio', icon: '✳' },
          { name: 'My Purchases', icon: '⇩' },
          { name: 'View Dataset', icon: '⌕' },
        ].map((item) => (
          <button
            key={item.name}
            className={`nav-item ${
              activePage === item.name ? 'active' : ''
            }`}
            onClick={() => setActivePage(item.name)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="network-indicator">
          <span className="status-dot" />
          <div>
            <strong>Blockchain</strong>
            <span>Marketplace workspace</span>
          </div>
        </div>
        <p>Decentralized data. Intelligent insights.</p>
      </div>
    </aside>

    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="breadcrumb">DATAVAULT / WORKSPACE</p>
          <h1>{activePage}</h1>
        </div>

        <div className="topbar-actions">
          <span className={`wallet-status ${account ? 'connected' : ''}`}>
            <span className="status-dot" />
            {account ? 'Wallet connected' : 'Wallet not connected'}
          </span>
          <button className="wallet-button" onClick={connectWallet}>
            {account
              ? `${account.slice(0, 6)}...${account.slice(-4)}`
              : 'Connect Wallet'}
          </button>
        </div>
      </header>

      {message && (
        <div className="status-message" role="status">
          {message}
        </div>
      )}

      {!account ? (
        <section className="welcome-card">
          <div className="welcome-content">
            <span className="eyebrow">DECENTRALIZED DATA PLATFORM</span>
            <h2>Your datasets.<br />Your marketplace.</h2>
            <p>
              Register datasets on the blockchain, explore available data,
              and use AI-powered tools to understand and verify your datasets.
            </p>
            <button className="primary-button" onClick={connectWallet}>
              Connect MetaMask <span>→</span>
            </button>
          </div>
          <div className="welcome-graphic">
            <div className="graphic-orbit orbit-one" />
            <div className="graphic-orbit orbit-two" />
            <div className="graphic-center">D</div>
            <span className="graphic-node node-one">AI</span>
            <span className="graphic-node node-two">IPFS</span>
            <span className="graphic-node node-three">WEB3</span>
          </div>
        </section>
      ) : (
        <>
          {activePage === 'Overview' && (
            <>
              <section className="welcome-card overview-welcome">
                <div className="welcome-content">
                  <span className="eyebrow">YOUR DATA WORKSPACE</span>
                  <h2>Welcome to your<br />data marketplace.</h2>
                  <p>
                    Manage your datasets, discover new data, and access
                    AI-powered analysis from one workspace.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => setActivePage('Marketplace')}
                  >
                    Explore Marketplace <span>→</span>
                  </button>
                </div>
                <div className="welcome-graphic">
                  <div className="graphic-orbit orbit-one" />
                  <div className="graphic-orbit orbit-two" />
                  <div className="graphic-center">D</div>
                  <span className="graphic-node node-one">AI</span>
                  <span className="graphic-node node-two">IPFS</span>
                  <span className="graphic-node node-three">WEB3</span>
                </div>
              </section>

              <div className="section-heading">
                <div>
                  <h2>Workspace overview</h2>
                  <p>Your marketplace at a glance.</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={loadDatasets}
                  disabled={loadingDatasets}
                >
                  {loadingDatasets ? 'Refreshing...' : '↻ Refresh data'}
                </button>
              </div>

              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon violet">▦</div>
                  <p>Total datasets loaded</p>
                  <h3>{datasets.length}</h3>
                  <span>Registered marketplace listings</span>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green">✓</div>
                  <p>Active datasets</p>
                  <h3>{datasets.filter((item) => item.active).length}</h3>
                  <span>Available for purchase</span>
                </div>
                <div className="stat-card">
                  <div className="stat-icon blue">⇩</div>
                  <p>My purchases</p>
                  <h3>{purchasedDatasets.length}</h3>
                  <span>Datasets purchased by this account</span>
                </div>
                <div className="stat-card">
                  <div className="stat-icon amber">✳</div>
                  <p>AI tools</p>
                  <h3>3</h3>
                  <span>Analysis, validation and verification</span>
                </div>
              </section>

              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Quick actions</h2>
                    <p>Choose what you'd like to do next.</p>
                  </div>
                </div>
                <div className="quick-actions">
                  <button
                    className="action-card"
                    onClick={() => setActivePage('Register Dataset')}
                  >
                    <span className="action-icon violet">＋</span>
                    <strong>Register a dataset</strong>
                    <span>Upload CSV and register on-chain →</span>
                  </button>
                  <button
                    className="action-card"
                    onClick={() => setActivePage('Marketplace')}
                  >
                    <span className="action-icon blue">▦</span>
                    <strong>Explore marketplace</strong>
                    <span>Browse available datasets →</span>
                  </button>
                  <button
                    className="action-card"
                    onClick={() => setActivePage('AI Studio')}
                  >
                    <span className="action-icon green">✳</span>
                    <strong>Open AI Studio</strong>
                    <span>Analyze and verify dataset data →</span>
                  </button>
                </div>
              </section>
            </>
          )}

          {activePage === 'Register Dataset' && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Register a dataset</h2>
                  <p>Upload your CSV to IPFS and register it on the blockchain.</p>
                </div>
                <span className="feature-tag">IPFS + WEB3</span>
              </div>

              <div className="form-section">
                <label htmlFor="dataset-csv-file">Dataset CSV file</label>
                <input
                  id="dataset-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] || null)
                  }
                />
                {selectedFile && (
                  <p className="helper-text">
                    Selected file: {selectedFile.name}
                  </p>
                )}
                <button
                  className="secondary-button"
                  onClick={uploadDatasetToIPFS}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : '↑ Upload CSV to IPFS'}
                </button>
              </div>

              <div className="form-grid">
                <div>
                  <label htmlFor="dataset-name">Dataset name</label>
                  <input
                    id="dataset-name"
                    placeholder="e.g. Student Performance Data"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="dataset-price">Price (ETH)</label>
                  <input
                    id="dataset-price"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div className="full-width">
                  <label htmlFor="dataset-description">Description</label>
                  <textarea
                    id="dataset-description"
                    placeholder="Describe the dataset and its contents..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="full-width">
                  <label htmlFor="dataset-cid">IPFS content identifier (CID)</label>
                  <input
                    id="dataset-cid"
                    placeholder="Filled after upload"
                    value={ipfsCID}
                    onChange={(e) => setIpfsCID(e.target.value)}
                  />
                </div>
                <div className="full-width">
                  <label htmlFor="dataset-hash">Dataset hash</label>
                  <input
                    id="dataset-hash"
                    placeholder="Filled after upload"
                    value={dataHash}
                    onChange={(e) => setDataHash(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-footer">
                <p>Your dataset metadata will be registered on the connected blockchain.</p>
                <button
                  className="primary-button"
                  onClick={registerDataset}
                  disabled={registering || uploading}
                >
                  {registering ? 'Registering...' : 'Register on Blockchain →'}
                </button>
              </div>
            </section>
          )}

          {activePage === 'Marketplace' && (
            <>
              <section className="marketplace-banner">
                <div>
                  <span className="eyebrow">DISCOVER DATA</span>
                  <h2>Explore the marketplace</h2>
                  <p>Discover datasets registered on the blockchain.</p>
                </div>
                <button
                  className="primary-button"
                  onClick={loadDatasets}
                  disabled={loadingDatasets}
                >
                  {loadingDatasets ? 'Loading...' : '↻ Load datasets'}
                </button>
              </section>

              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Available datasets</h2>
                    <p>{datasets.length} listing(s) currently loaded.</p>
                  </div>
                </div>

                {datasets.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">▦</div>
                    <h3>No datasets loaded yet</h3>
                    <p>Connect to the blockchain and load the registered datasets.</p>
                    <button
                      className="secondary-button"
                      onClick={loadDatasets}
                      disabled={loadingDatasets}
                    >
                      {loadingDatasets ? 'Loading...' : 'Load datasets'}
                    </button>
                  </div>
                ) : (
                  <div className="dataset-grid">
                    {datasets.map((item) => (
                      <article className="dataset-card" key={item.id}>
                        <div className="dataset-card-top">
                          <span className="dataset-symbol">▤</span>
                          <span className={`feature-tag ${item.active ? 'tag-active' : ''}`}>
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="dataset-id">DATASET #{item.id}</p>
                        <h3>{item.name}</h3>
                        <p>{item.description}</p>
                        <div className="dataset-price">
                          <span>Listed price</span>
                          <strong>{item.price} ETH</strong>
                        </div>
                        <div className="dataset-meta">
                          <span>Seller</span>
                          <span>{item.seller.slice(0, 6)}...{item.seller.slice(-4)}</span>
                        </div>
                        <div className="dataset-card-actions">
                          {item.active && (
                            <button
                              className="primary-button"
                              onClick={() =>
                                purchaseDataset(
                                  item.id,
                                  ethers.parseEther(item.price.toString())
                                )
                              }
                            >
                              Purchase dataset
                            </button>
                          )}
                          <button
                            className="secondary-button"
                            onClick={() => openIPFS(item.ipfsCID)}
                          >
                            View on IPFS ↗
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activePage === 'AI Studio' && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>AI Studio</h2>
                  <p>Analyze and validate your registered dataset using the AI backend.</p>
                </div>
                <span className="feature-tag">AI TOOLS</span>
              </div>

              <div className="form-section">
                <label htmlFor="ai-dataset-id">Registered dataset ID</label>
                <div className="inline-form">
                  <input
                    id="ai-dataset-id"
                    type="number"
                    min="1"
                    placeholder="Dataset ID"
                    value={datasetId}
                    onChange={(e) => setDatasetId(e.target.value)}
                  />
                  <button
                    className="secondary-button"
                    onClick={viewDataset}
                  >
                    Load dataset
                  </button>
                </div>
                {dataset && (
                  <div className="loaded-dataset">
                    <strong>{dataset.name}</strong>
                    <p>{dataset.description}</p>
                    <span className="helper-text">IPFS CID: {dataset.ipfsCID}</span>
                  </div>
                )}
              </div>

              <div className="form-section">
                <label htmlFor="ai-target-column">Target column for model validation</label>
                <input
                  id="ai-target-column"
                  value={aiTarget}
                  onChange={(e) => setAiTarget(e.target.value)}
                  placeholder="e.g. Marks"
                />
                <p className="helper-text">
                  Enter the target column appropriate for your dataset.
                </p>
              </div>

              {aiError && <div className="error-box" role="alert">{aiError}</div>}

              <div className="ai-actions">
                <button
                  className="action-card"
                  onClick={analyzeDataset}
                  disabled={aiLoading}
                >
                  <span className="action-icon violet">◫</span>
                  <strong>Analyze dataset</strong>
                  <span>Review dataset statistics and structure.</span>
                  <span className="action-link">
                    {aiLoading ? 'Processing...' : 'Run analysis →'}
                  </span>
                </button>
                <button
                  className="action-card"
                  onClick={validateModel}
                  disabled={aiLoading}
                >
                  <span className="action-icon blue">⌁</span>
                  <strong>Validate model</strong>
                  <span>Run model validation through your backend.</span>
                  <span className="action-link">
                    {aiLoading ? 'Processing...' : 'Validate model →'}
                  </span>
                </button>
                <button
                  className="action-card"
                  onClick={verifyDataset}
                  disabled={aiLoading}
                >
                  <span className="action-icon green">✓</span>
                  <strong>Verify dataset</strong>
                  <span>Check the dataset using your verification service.</span>
                  <span className="action-link">
                    {aiLoading ? 'Processing...' : 'Verify dataset →'}
                  </span>
                </button>
              </div>

              {aiLoading && <p className="helper-text">Processing your request...</p>}

              {[
                { title: 'Dataset analysis result', value: analysisResult },
                { title: 'Model validation result', value: modelResult },
                { title: 'Dataset verification result', value: verificationResult },
              ].map((result) =>
                result.value ? (
                  <div className="result-panel" key={result.title}>
                    <h3>{result.title}</h3>
                    <pre>{JSON.stringify(result.value, null, 2)}</pre>
                  </div>
                ) : null
              )}
            </section>
          )}

          {activePage === 'My Purchases' && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>My purchases</h2>
                  <p>Datasets purchased by the connected wallet account.</p>
                </div>
                <span className="feature-tag">
                  {purchasedDatasets.length} PURCHASED
                </span>
              </div>

              {purchasedDatasets.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">⇩</div>
                  <h3>No purchases found</h3>
                  <p>Load the marketplace listings and purchase a dataset to see it here.</p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setActivePage('Marketplace')
                      loadDatasets()
                    }}
                  >
                    Explore marketplace →
                  </button>
                </div>
              ) : (
                <div className="dataset-grid">
                  {purchasedDatasets.map((item) => (
                    <article className="dataset-card" key={item.id}>
                      <div className="dataset-card-top">
                        <span className="dataset-symbol">▤</span>
                        <span className="feature-tag tag-active">Purchased</span>
                      </div>
                      <p className="dataset-id">DATASET #{item.id}</p>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div className="dataset-price">
                        <span>Purchase price</span>
                        <strong>{item.price} ETH</strong>
                      </div>
                      <button
                        className="primary-button"
                        onClick={() => openIPFS(item.ipfsCID)}
                      >
                        Open dataset on IPFS ↗
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activePage === 'View Dataset' && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>View dataset details</h2>
                  <p>Retrieve dataset metadata from the smart contract.</p>
                </div>
              </div>
              <div className="inline-form">
                <input
                  type="number"
                  min="1"
                  placeholder="Enter dataset ID"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                />
                <button className="primary-button" onClick={viewDataset}>
                  View dataset
                </button>
              </div>
              {dataset && (
                <div className="details-grid">
                  {[
                    ['Dataset ID', dataset.id],
                    ['Name', dataset.name],
                    ['Description', dataset.description],
                    ['IPFS CID', dataset.ipfsCID],
                    ['Data hash', dataset.dataHash],
                    ['Price', `${dataset.price} ETH`],
                    ['Seller', dataset.seller],
                    ['Registered', dataset.timestamp],
                    ['Status', dataset.active ? 'Active' : 'Inactive'],
                  ].map(([label, value]) => (
                    <div className="detail-item" key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                  <button
                    className="secondary-button"
                    onClick={() => openIPFS(dataset.ipfsCID)}
                  >
                    Open dataset on IPFS ↗
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <footer className="workspace-footer">
        <span>DataVault · Blockchain AI Dataset Marketplace</span>
        <span>Decentralized data management</span>
      </footer>
    </main>
  </div>
)

}




export default App
