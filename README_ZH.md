scry.info系统的的基础库.
已经提交到npm中, 可以使用以下命令安装:
```bash
npm install scryinfo --save
```
scryinfo是对eth的一些操作方法封装.有了web3,为什么还要再封装呢?
因为web3提供的api是零散化的,在实际生产环境中,往往需要将这些零散化的api调用再次封装为一个整体的,带有能执行某项特定业务功能的函数.
所以我们封装了一部分符合scry.info业务操作方便的api. 以最简单的获取一个合约对象为例:
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
调用者只需要传入address和abi即可,简化了调用.
另外还封装transaction的相关方法,以便达到通过代理节点(类似轻钱包)发布/创建/操作contract的目的.
比如发送代币,可以调用:
```javascript
scryinfo.sendToken("0x6ad565700eb68ddcd0b7da06fb2281eda779eb31", "0x8cb754fff076f9b34a72782cee4192021c91f691", "password", 101, (rs)=>{
    console.log(rs);
})
```
这样就能通过存储在本地的账号来发送scry mana token.

总体来说,主要是封装了轻钱包的部分功能,通过代理来方便操作eth.
用户的eth账户(私钥)都存储在本地app环境中(scryInfo/app_android和scryInfo/app_iOS这2个项目提供了移动端的app)


未完待续...
