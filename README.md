Basic library of scry.info syetem
As mentioned in npm, install using the following command:
```bash
npm install scryinfo --save
```
scryinfo packed some operations to eth. Why we pack after using web3?
In actual developing environment, all the APIs web3 provides are scattered and usually needs to be packed as one function to implement certain business function, so some APIs that fit Scry.info business operations are packed for convenience. The following is an example of acquiring an contract object:
```javascript
/**
    Get a instance of contract by address and abi.
    @param address string.
    @param abi string.
    @return object
*/
Scry.prototype.getContractInstance = function(address, abi) {
    if (typeof(address) != "string" || typeof(abi) != "string") {
        throw new Error("address or abi is null.");
    }
    var abiObj = typeof(abi) == "string" ? JSON.parse(abi) : abi;
    var _contract = this.eth.contract(abiObj);
    var _contractInst = _contract.at(address);
    return _contractInst;
};
```
A call only needs to enter the address and abi, this simplifies the call.
In addition, transaction related operations are packed for the purpose of publish, create, operation of contract through proxy node (like lite wallet).
For example, token delivery:
```javascript
scryinfo.sendToken("0x6ad565700eb68ddcd0b7da06fb2281eda779eb31", "0x8cb754fff076f9b34a72782cee4192021c91f691", "password", 101, (rs)=>{
    console.log(rs);
})
```
In this way, scry mana token can be delivered through accounts saved locally.

Generally speaking, it is mainly packed part functions on lite wallet and made it easier to operate eth through proxy.
User's eth account (private key) is saved in local app environment (scryInfo/app_android and scryInfo/app_iOS provide the mobile app).


To be continued...
