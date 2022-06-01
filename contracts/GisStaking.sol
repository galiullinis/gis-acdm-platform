// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract GisStaking is AccessControl{
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    uint256 public rewardFrequency = 7 days;
    uint256 public rewardPercent = 3;
    uint256 public rewardPercentAccuracy = 0;
    uint256 public freezeTime = 30 days;
    uint256 public maxStakingTime = 60 days;
    address public daoContract;

    IERC20 public rewardToken;
    IERC20 public stakingToken;

    struct StakerInfo{
        uint256 balance;
        uint256 reward;
        uint256 updatedAt;
        uint256 startedAt;
        uint256 stoppedAt;
    }

    mapping(address => StakerInfo) stakers;

    event Staked(
        address indexed staker,
        uint256 amount
    );

    event Claimed(
        address indexed claimer,
        uint256 rewardAmount
    );

    event Unstaked(
        address indexed unstaker,
        uint256 amount,
        uint256 rewardAmount
    );


    constructor(address _stakingTokenAddress, address _rewardTokenAddress){
        rewardToken = IERC20(_rewardTokenAddress);
        stakingToken = IERC20(_stakingTokenAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(DAO_ROLE, DEFAULT_ADMIN_ROLE);
    }

    function isStakingActive(address staker) internal view returns(bool){
        return (stakers[staker].stoppedAt > block.timestamp);
    }

    function getReward(address staker) public view returns(uint256){
        if (!isStakingActive(staker)){
            return stakers[staker].reward + stakers[staker].balance * (rewardPercent / 10 ** rewardPercentAccuracy) / 100 * (stakers[staker].stoppedAt - stakers[staker].updatedAt) / rewardFrequency;
        } else {
            return stakers[staker].reward + stakers[staker].balance * (rewardPercent / 10 ** rewardPercentAccuracy) / 100 * (block.timestamp - stakers[staker].updatedAt) / rewardFrequency;
        }
    }

    function stake(uint256 amount) public returns(bool){
        if (stakers[msg.sender].balance != 0){
            require(isStakingActive(msg.sender), "staking has reached the limit");
            stakers[msg.sender].reward = getReward(msg.sender);
        } else {
            stakers[msg.sender].startedAt = block.timestamp;
            stakers[msg.sender].stoppedAt = block.timestamp + maxStakingTime;
        }
        stakingToken.transferFrom(msg.sender, address(this), amount);
        unchecked {
            stakers[msg.sender].balance += amount;            
        }
        stakers[msg.sender].updatedAt = block.timestamp;

        emit Staked(
            msg.sender,
            amount
        );

        return true;
    }

    function claim() public returns(bool){
        require(stakers[msg.sender].balance != 0 || stakers[msg.sender].reward != 0, "can not get reward");
        require(stakers[msg.sender].startedAt + freezeTime < block.timestamp, "tokens freezed");
        rewardToken.transfer(msg.sender, getReward(msg.sender));

        emit Claimed(
            msg.sender,
            getReward(msg.sender)
        );

        stakers[msg.sender].reward = 0;
        return true;
    }

    function unstake() public returns(bool){
        require(stakers[msg.sender].balance != 0, "staked 0 tokens");
        require(stakers[msg.sender].startedAt + freezeTime < block.timestamp, "tokens freezed");
        require(isWithdrawableInDAO(msg.sender), "you have an active proposal in the dao");
        stakingToken.transfer(msg.sender, stakers[msg.sender].balance);
        rewardToken.transfer(msg.sender, getReward(msg.sender));

        emit Unstaked(
            msg.sender,
            stakers[msg.sender].balance,
            getReward(msg.sender)
        );

        stakers[msg.sender].reward = 0;
        stakers[msg.sender].balance = 0;
        return true;
    }


    function setRewardFrequency(uint256 _rewardFrequency) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "you don't have admin role");
        rewardFrequency = _rewardFrequency;
    }

    function setRewardPercent(uint256 _rewardPercent, uint256 _rewardPercentAccuracy) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "you don't have admin role");
        rewardPercent = _rewardPercent;
        rewardPercentAccuracy = _rewardPercentAccuracy;
    }

    function setFreezeTime(uint256 _freezeTime) public {
        require(hasRole(DAO_ROLE, msg.sender), "available only dao");
        freezeTime = _freezeTime;
    }

    function setMaxStakingTime(uint256 _maxStakingTime) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "you don't have admin role");
        maxStakingTime = _maxStakingTime;
    }

    function isWithdrawableInDAO(address _address) public returns(bool){
        (bool success, bytes memory result) = daoContract.call(
            abi.encodeWithSignature("hasNotActiveProposal(address)", _address)
        );
        require(success, string(result));
        return abi.decode(result, (bool));
    }

    function getAddressBalance(address _address) public view returns(uint256){
        return stakers[_address].balance;
    }

    function setDaoContract(address _address) public {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "not an owner");
        require(_address != address(0), "zero address");
        daoContract = _address;
    }
}