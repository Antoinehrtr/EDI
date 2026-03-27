// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title EDI Badge — gas-optimised ERC-721 badge minter
/// @notice Stores only the 32-byte IPFS SHA-256 hash per token instead of the full URI string.
///         tokenURI() reconstructs the full ipfs:// URI on-the-fly via base58 encoding.
contract EDIBadge is ERC721, Ownable {
    uint256 private _nextTokenId;

    /// @dev Maps tokenId → raw SHA-256 hash of the IPFS metadata (32 bytes = 1 storage slot)
    mapping(uint256 => bytes32) private _tokenHashes;

    /// @notice Emitted on every mint. URI omitted from event — read it via tokenURI().
    event BadgeMinted(address indexed recipient, uint256 indexed tokenId);

    constructor(address initialOwner)
        ERC721("EDI Badge", "EDIB")
        Ownable(initialOwner)
    {}

    /// @notice Mint a badge. `ipfsHash` is the raw 32-byte SHA-256 digest of the metadata CID.
    function mint(address to, bytes32 ipfsHash) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);                  // cheaper than _safeMint (no onERC721Received check)
        _tokenHashes[tokenId] = ipfsHash;    // 1 SSTORE vs 3 for a full URI string
        emit BadgeMinted(to, tokenId);
        return tokenId;
    }

    /// @notice Returns the full ipfs:// URI reconstructed from the stored hash.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "EDIBadge: URI query for nonexistent token");
        // Prepend the IPFS multihash prefix (0x1220 = sha2-256, length 32) then base58-encode
        return string(
            abi.encodePacked(
                "ipfs://",
                _base58Encode(abi.encodePacked(hex"1220", _tokenHashes[tokenId]))
            )
        );
    }

    // ─── Base58 encoding ────────────────────────────────────────────────────────

    bytes internal constant _ALPHABET =
        "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    /// @dev Encodes arbitrary bytes to a base58 string (Bitcoin / IPFS alphabet).
    function _base58Encode(bytes memory input) internal pure returns (string memory) {
        // Upper-bound on output length: ceil(inputLen * log(256) / log(58)) ≈ input * 1.37
        uint256 maxLen = (input.length * 137) / 100 + 2;
        uint8[] memory digits = new uint8[](maxLen);
        uint256 digitLen = 0;

        for (uint256 i = 0; i < input.length; i++) {
            uint256 carry = uint8(input[i]);
            for (uint256 j = 0; j < digitLen; j++) {
                carry += uint256(digits[j]) << 8;
                digits[j] = uint8(carry % 58);
                carry /= 58;
            }
            while (carry > 0) {
                digits[digitLen++] = uint8(carry % 58);
                carry /= 58;
            }
        }

        bytes memory output = new bytes(digitLen);
        for (uint256 i = 0; i < digitLen; i++) {
            output[i] = _ALPHABET[digits[digitLen - 1 - i]];
        }
        return string(output);
    }
}
