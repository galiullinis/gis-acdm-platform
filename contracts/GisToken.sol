// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract GisToken is AccessControl{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    uint8 public decimals;
    string public name;
    string public symbol;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    constructor(string memory _name, string memory _symbol, uint8 _decimals){
        require(bytes(_name).length != 0 && bytes(_symbol).length != 0, "incorrect params.");
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = msg.sender;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(MINTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    modifier processable(address account, uint256 amount) {
        require(account != address(0), "account should not be the zero address.");
        require(amount != 0, "amount should not be zero.");
        _;
    }

    event Transfer(
        address indexed _from,
        address indexed _to,
        uint256 _value
    );

    event Approval(
        address indexed _owner, 
        address indexed _spender,
        uint256 _value
    );

    function balanceOf(address _owner) public view returns (uint256 balance){
        return _balances[_owner];
    }

    function transfer(address _to, uint256 _value) public returns (bool){
        _transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool){
        require(allowance(_from, msg.sender) >= _value, "incorrect allowance.");
        _transfer(_from, _to, _value);
        unchecked {
            _allowances[_from][msg.sender] -= _value;            
        }
        emit Approval(_from, msg.sender, _allowances[_from][msg.sender]);

        return true;
    }

    function _transfer(address _from, address _to, uint256 _value) private {
        require(_to != address(0), "try to send tokens to the zero address.");
        require(_balances[_from] >= _value, "not enough tokens on sender balance.");
        unchecked {
            _balances[_from] -= _value;
            _balances[_to] += _value;    
        }
        
        emit Transfer(_from, _to, _value);
    }

    function approve(address _spender, uint256 _value) public returns(bool){
        require(_spender != address(0), "spender address should not be the zero address.");
        require(msg.sender != _spender, "owner and spender adresses are equal.");
        _allowances[msg.sender][_spender] = _value;
        return true;
    }

    function allowance(address _owner, address _spender) public view returns(uint256){
        return _allowances[_owner][_spender];
    }

    function mint(address account, uint256 amount) processable(account, amount) public virtual {
        require(hasRole(MINTER_ROLE, msg.sender), "you are not a minter");
        _balances[account] += amount;
        totalSupply += amount;
        emit Transfer(address(0), account, amount);
    }
    
    function burn(address account, uint256 amount) processable(account, amount) public virtual {
        require(hasRole(BURNER_ROLE, msg.sender), "you are not a burner");
        require(_balances[account] >= amount, "burn amount larger than account balance.");
        unchecked {
            _balances[account] -= amount;
            totalSupply -= amount;    
        }
        emit Transfer(account, address(0), amount);
    }

}
