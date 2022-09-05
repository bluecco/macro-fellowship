//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "./Project.sol";

contract ProjectFactory {
    event ProjectCreated(
        address indexed newProject,
        uint256 goal,
        uint256 endAt
    );

    Project[] public projects;

    /// @notice create a new project contract
    /// @param _name The name of the fundraising project to be used in the NFT badges
    /// @param _tokenSymbol The NFT token symbol
    /// @param _goal The ether goal needed for the fundraising
    /// @dev fundraising time will be always 30 days from creation time
    function create(
        string memory _name,
        string memory _tokenSymbol,
        uint256 _goal
    ) external returns (Project) {
        uint256 _endAt = block.timestamp + 30 days;

        Project newProject = new Project(
            _name,
            _tokenSymbol,
            msg.sender,
            _goal,
            _endAt
        );
        projects.push(newProject);
        emit ProjectCreated(address(newProject), _goal, _endAt);
        return newProject;
    }
}
