// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract DatasetMarketplace {
    struct Dataset {
        uint256 id;
        address payable seller;
        string name;
        string description;
        string ipfsCID;
        string dataHash;
        uint256 price;
        uint256 timestamp;
        bool active;
    }

    uint256 private nextDatasetId = 1;

    mapping(uint256 => Dataset) public datasets;

    event DatasetRegistered(
        uint256 indexed id,
        address indexed seller,
        string name,
        uint256 price
    );

    event DatasetPurchased(
        uint256 indexed id,
        address indexed buyer,
        uint256 price
    );

    event DatasetDeactivated(uint256 indexed id);

    function registerDataset(
        string memory _name,
        string memory _description,
        string memory _ipfsCID,
        string memory _dataHash,
        uint256 _price
    ) public {
        require(bytes(_name).length > 0, "Dataset name required");
        require(bytes(_ipfsCID).length > 0, "IPFS CID required");
        require(bytes(_dataHash).length > 0, "Dataset hash required");
        require(_price > 0, "Price must be greater than zero");

        datasets[nextDatasetId] = Dataset({
            id: nextDatasetId,
            seller: payable(msg.sender),
            name: _name,
            description: _description,
            ipfsCID: _ipfsCID,
            dataHash: _dataHash,
            price: _price,
            timestamp: block.timestamp,
            active: true
        });

        emit DatasetRegistered(
            nextDatasetId,
            msg.sender,
            _name,
            _price
        );

        nextDatasetId++;
    }

    function purchaseDataset(uint256 _datasetId) public payable {
        Dataset storage dataset = datasets[_datasetId];

        require(dataset.id != 0, "Dataset does not exist");
        require(dataset.active, "Dataset is not active");
        require(msg.value == dataset.price, "Incorrect payment");
        require(msg.sender != dataset.seller, "Seller cannot purchase own dataset");

        (bool success, ) = dataset.seller.call{value: msg.value}("");
        require(success, "Payment failed"); 

        emit DatasetPurchased(
            _datasetId,
            msg.sender,
            msg.value
        );
    }

    function deactivateDataset(uint256 _datasetId) public {
        Dataset storage dataset = datasets[_datasetId];

        require(dataset.id != 0, "Dataset does not exist");
        require(msg.sender == dataset.seller, "Only seller can deactivate");

        dataset.active = false;

        emit DatasetDeactivated(_datasetId);
    }

    function getDataset(uint256 _datasetId)
        public
        view
        returns (Dataset memory)
    {
        require(datasets[_datasetId].id != 0, "Dataset does not exist");

        return datasets[_datasetId];
    }

    function getTotalDatasets() public view returns (uint256) {
        return nextDatasetId - 1;
    }
}