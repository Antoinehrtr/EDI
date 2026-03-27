// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title EDI Badge — ERC-721 badge minter for ELCA Digital Innovation
contract EDIBadge is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    event BadgeMinted(address indexed recipient, uint256 indexed tokenId, string tokenURI);

    constructor(address initialOwner) ERC721("EDI Badge", "EDIB") Ownable(initialOwner) {}

    /// @notice Mint a badge NFT to a recipient. Only callable by the contract owner (the minter wallet).
    function mint(address to, string calldata tokenURI_) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        emit BadgeMinted(to, tokenId, tokenURI_);
        return tokenId;
    }
}
