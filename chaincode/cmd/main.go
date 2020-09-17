package main

import (
	"fmt"
	"forex"
	"github.com/hyperledger/fabric/core/chaincode/shim"
)

func main() {
	err := shim.Start(new(forex.FxChaincode))
	if err != nil {
		fmt.Printf("Error creating new FxChaincode: %s", err)
	}

}
