//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

/**
    @title An ACDM Platform for token sale
    @author Ildar Galiullin S.
    @notice Not for production use!
    @custom:experimental This is an experimental contract.
 */
contract ACDMPlatform is AccessControl{    
    using Counters for Counters.Counter;
    Counters.Counter private currentRoundId;
    Counters.Counter private currentOrderId;
    uint256 public constant amountPrecision = 6;
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

    IERC20 public acdmToken;
    uint256 public roundTime;

    RewardSettings public saleRewardSettings;
    RewardSettings public tradeRewardSettings;

    mapping(address => UserInfo) users;
    mapping(uint256 => Sale) saleRounds;
    mapping(uint256 => Trade) tradeRounds;
    mapping(uint256 => Order) orders;

    // Structs
    struct RewardSettings {
        uint256 firstRewardPercent;
        uint256 secondRewardPercent;
        uint256 rewardPercentPrecision;
    }

    struct Sale {
        bool isActive;
        uint256 tokenAmount;
        uint256 tokenPrice;
        uint256 startedAt;
        uint256 stoppedAt;
    }

    struct Trade {
        bool isActive;
        uint256 startedAt;
        uint256 stoppedAt;
        uint256 turnover;
    }

    struct Order {
        bool isActive;
        address seller;
        uint256 tokenAmount;
        uint256 tokenPrice;
    }

    struct UserInfo {
        bool isRegistered;
        address referrer;
    }

    // Events
    event SaleStarted(
        uint256 indexed id,
        uint256 tokenAmount,
        uint256 tokenPrice
    );

    event ACDMBought(
        uint256 indexed id,
        uint256 tokenAmount,
        address indexed buyer
    );

    event TradeStarted(
        uint256 indexed id
    );

    event OrderAdded(
        uint256 indexed id,
        uint256 tokenAmount,
        uint256 tokenPrice,
        address indexed seller
    );

    event OrderRemoved(
        uint256 indexed id
    );

    event OrderRedeemed(
        uint256 indexed id,
        uint256 tokenAmount,
        address indexed buyer
    );

    modifier tradable {
        Trade memory tradeRound = tradeRounds[currentRoundId.current()];
        require(tradeRound.isActive == true && tradeRound.stoppedAt > block.timestamp, "trade round is not active");
        _;
    }

    modifier onlyRegistered {
        require(users[msg.sender].isRegistered == true, "not registered");
        _;
    }

    modifier onlyDAO {
        require(hasRole(DAO_ROLE, msg.sender), "available only dao");
        _;
    }

    constructor(address _acdmToken, uint256 _roundTime){
        require(_acdmToken != address(0) && _roundTime > 0, "incorrect params");
        acdmToken = IERC20(_acdmToken);
        roundTime = _roundTime;

        // initialize first round
        saleRounds[1].tokenAmount = 100000 * (10 ** amountPrecision);
        saleRounds[1].tokenPrice = 10000 gwei;
        // initialize reward settings
        saleRewardSettings.firstRewardPercent = 5;
        saleRewardSettings.secondRewardPercent = 3;
        saleRewardSettings.rewardPercentPrecision = 0;
        tradeRewardSettings.firstRewardPercent = 25;
        tradeRewardSettings.secondRewardPercent = 25;
        tradeRewardSettings.rewardPercentPrecision = 1;
        // AccessControl
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(DAO_ROLE, DEFAULT_ADMIN_ROLE);
    }

    /**
        @notice Register user
    */
    function register() public {
        require(users[msg.sender].isRegistered == false, "user had already registered");
        users[msg.sender].isRegistered = true;
    }

    /**
        @notice Register user with referrer
        @param _address The referrer address
    */
    function register(address _address) public {
        require(users[_address].isRegistered == true, "referrer not registered");
        register();
        users[msg.sender].referrer = _address;
    }

    /**
        @notice Start sale round
    */
    function startSaleRound() onlyRegistered public {
        currentRoundId.increment();
        if (currentRoundId.current() > 1) {
            Sale memory prevSaleRound = saleRounds[currentRoundId.current() - 1];
            Trade memory prevTradeRound = tradeRounds[currentRoundId.current() - 1];
            require(prevSaleRound.stoppedAt < block.timestamp || prevSaleRound.isActive == false, "sale round is active");
            require(prevTradeRound.startedAt > 0 && (prevTradeRound.stoppedAt < block.timestamp || prevTradeRound.isActive == false), "trade round is not finished");
            _initializeRound(prevSaleRound, prevTradeRound);
        }
        Sale storage saleRound = saleRounds[currentRoundId.current()];
        saleRound.isActive = true;
        saleRound.startedAt = block.timestamp;
        saleRound.stoppedAt = block.timestamp + roundTime;
        emit SaleStarted(currentRoundId.current(), saleRound.tokenAmount, saleRound.tokenPrice);
    }

    /**
        @notice Buy ACDM tokens on sale
    */
    function buyACDM() onlyRegistered public payable {
        Sale storage saleRound = saleRounds[currentRoundId.current()];
        require(saleRound.isActive == true, "sale is not active");
        require(saleRound.stoppedAt > block.timestamp, "round expired");
        require(msg.value >= saleRound.tokenPrice / 10 ** amountPrecision, "not enough ethers sent");
        uint256 acdmTokensCount = (10 ** amountPrecision) * msg.value / saleRound.tokenPrice;
        uint256 payback;
        if (acdmTokensCount > saleRound.tokenAmount){
            uint256 excess;
            unchecked {
                excess = acdmTokensCount - saleRound.tokenAmount;
                acdmTokensCount = saleRound.tokenAmount;
            }
            payback = excess * saleRound.tokenPrice / 10 ** amountPrecision;
        }
        uint256 profit;
        unchecked {
            profit = msg.value - payback;
            saleRound.tokenAmount -= acdmTokensCount;
        }
        if(saleRound.tokenAmount == 0){
            saleRound.isActive = false;
        }
        if (payback > 0){
            payable(msg.sender).transfer(payback); 
        }
        // mint tokens to buyer
        _mintTokensToBuyer(msg.sender, acdmTokensCount);
        // reward referrers
        _rewardReferrers(msg.sender, profit, saleRewardSettings);

        emit ACDMBought(currentRoundId.current(), acdmTokensCount, msg.sender);
    }

    /**
        @notice Start trade round
    */
    function startTradeRound() onlyRegistered public {
        require(currentRoundId.current() != 0, "zero round");
        Sale memory saleRound = saleRounds[currentRoundId.current()];
        Trade storage tradeRound = tradeRounds[currentRoundId.current()];
        require(saleRound.stoppedAt < block.timestamp || saleRound.isActive == false, "sale round is not finished");
        require(tradeRound.isActive == false && tradeRound.startedAt == 0, "trade round is active");
        tradeRound.isActive = true;
        tradeRound.startedAt = block.timestamp;
        tradeRound.stoppedAt = block.timestamp + roundTime;
        emit TradeStarted(currentRoundId.current());
    }

    /**
        @notice Add order
        @param _amount Amount of the tokens to trade
        @param _price Price of the token (Currency: ETH)
    */
    function addOrder(uint256 _amount, uint256 _price) onlyRegistered tradable public {
        require(_amount > 0 && _price > 0, "incorrect params");
        require(acdmToken.balanceOf(msg.sender) >= _amount, "insufficient tokens on balance");
        currentOrderId.increment();
        orders[currentOrderId.current()].tokenAmount = _amount;
        orders[currentOrderId.current()].tokenPrice = _price;
        orders[currentOrderId.current()].seller = msg.sender;
        orders[currentOrderId.current()].isActive = true;
        acdmToken.transferFrom(msg.sender, address(this), _amount);
        emit OrderAdded(currentOrderId.current(), _amount, _price, msg.sender);
    }

    /**
        @notice Remove order
        @param _orderId Order ID to remove
    */
    function removeOrder(uint256 _orderId) onlyRegistered tradable public {
        Order storage order = orders[_orderId];
        require(order.seller == msg.sender, "you are not the seller");
        require(order.isActive == true, "order is not active");
        order.isActive = false;
        acdmToken.transfer(msg.sender, order.tokenAmount);
        emit OrderRemoved(_orderId);
    }

    /**
        @notice Redeem tokens by orderId
        @param _orderId Order ID to redeem 
    */
    function redeemOrder(uint256 _orderId) onlyRegistered tradable public payable {
        Order storage order = orders[_orderId];
        require(msg.sender != order.seller, "you are the seller");
        require(order.isActive == true, "order is not active");
        require(msg.value >= order.tokenPrice / 10 ** amountPrecision, "not enough ethers sent");
        uint256 payback;
        uint256 acdmTokensCount = (10 ** amountPrecision) * msg.value / order.tokenPrice;
        if (acdmTokensCount > order.tokenAmount){
            uint256 excess = acdmTokensCount - order.tokenAmount;
            acdmTokensCount = order.tokenAmount;
            payback += excess * order.tokenPrice / 10 ** amountPrecision;
        }
        unchecked {
            order.tokenAmount -= acdmTokensCount;            
        }
        if(order.tokenAmount == 0){
            order.isActive = false;
        }

        if (payback > 0){
            payable(msg.sender).transfer(payback);
        }
        uint256 profit;
        unchecked {
            profit = msg.value - payback;     
            tradeRounds[currentRoundId.current()].turnover += profit;
        }
        // send tokens to buyer
        acdmToken.transfer(msg.sender, acdmTokensCount);
        // send funds to seller
        payable(order.seller).transfer(profit * (100 - (tradeRewardSettings.firstRewardPercent + tradeRewardSettings.secondRewardPercent) / 10 ** tradeRewardSettings.rewardPercentPrecision) / 100);
        // reward referrers
        _rewardReferrers(order.seller, profit, tradeRewardSettings);

        emit OrderRedeemed(currentRoundId.current(), acdmTokensCount, msg.sender);
    }

    /**
        @notice Helper function to call mint method in acdmToken contract
        @param _to The address to which need to mint tokens
        @param _amount Amount of tokens. 
    */
    function _mintTokensToBuyer(address _to, uint256 _amount) private {
        (bool success, bytes memory result) = address(acdmToken).call(
            abi.encodeWithSignature("mint(address,uint256)", _to, _amount)
        );
        require(success, string(result));
    }

    /**
        @notice Function to reward the buyer referrers
        @param _origin The address of the origin user
        @param _spending Amount of ETH which buyer spended to buy acdmTokens.
    */
    function _rewardReferrers(address _origin, uint256 _spending, RewardSettings memory _rewardSettings) private {
        address firstReferrer = users[_origin].referrer;
        if (firstReferrer != address(0)){
            payable(firstReferrer).transfer(_rewardSettings.firstRewardPercent * _spending / 100 / 10 ** _rewardSettings.rewardPercentPrecision);
            address secondReferrer = users[firstReferrer].referrer;
            if (secondReferrer != address(0)){
                payable(secondReferrer).transfer(_rewardSettings.secondRewardPercent * _spending / 100 / 10 ** _rewardSettings.rewardPercentPrecision);
            }
        }
    }

    /**
        @notice Initialize round
    */
    function _initializeRound(Sale memory prevSaleRound, Trade memory prevTradeRound) private {
        saleRounds[currentRoundId.current()].tokenPrice = prevSaleRound.tokenPrice * 103 / 100 + 4000 gwei;
        saleRounds[currentRoundId.current()].tokenAmount = (10 ** amountPrecision) * prevTradeRound.turnover / prevSaleRound.tokenPrice;
    }

    /**
        @notice Withdraw all funds from contract
        @param _addr Address where to send funds
    */
    function withdraw(address _addr) onlyDAO public {
        payable(_addr).transfer(address(this).balance);
    } 

    /**
        @notice Get user info by address
        @param _addr Address of the user
    */
    function getUserByAddress(address _addr) public view returns(UserInfo memory){
        return users[_addr];
    }

    /**
        @notice Get sale round information by round id
        @param _roundId Round Id
    */
    function getSaleByRoundId(uint256 _roundId) public view returns(Sale memory){
        return saleRounds[_roundId];
    }

    /**
        @notice Get trade round information by round id
        @param _roundId Round Id
    */
    function getTradeByRoundId(uint256 _roundId) public view returns(Trade memory){
        return tradeRounds[_roundId];
    }

    /**
        @notice Get order information by order id
        @param _orderId Order Id
    */
    function getOrderById(uint256 _orderId) public view returns(Order memory){
        return orders[_orderId];
    }

    /**
        @notice Set new reward settings for Sale round
        @param _firstRewardPercent Reward percent for first referrer
        @param _secondRewardPercent Reward percent for second referrer
        @param _percentPrecision Reward percent precision
    */
    function setSaleRewardSettings(uint256 _firstRewardPercent, uint256 _secondRewardPercent, uint256 _percentPrecision) onlyDAO public {
        saleRewardSettings.firstRewardPercent = _firstRewardPercent;
        saleRewardSettings.secondRewardPercent = _secondRewardPercent;
        saleRewardSettings.rewardPercentPrecision = _percentPrecision;
    }

    /**
        @notice Set new reward settings for Trade round
        @param _firstRewardPercent Reward percent for first referrer
        @param _secondRewardPercent Reward percent for second referrer
        @param _percentPrecision Reward percent precision
    */
    function setTradeRewardSettings(uint256 _firstRewardPercent, uint256 _secondRewardPercent, uint256 _percentPrecision) onlyDAO public {
        tradeRewardSettings.firstRewardPercent = _firstRewardPercent;
        tradeRewardSettings.secondRewardPercent = _secondRewardPercent;
        tradeRewardSettings.rewardPercentPrecision = _percentPrecision;
    }
}
