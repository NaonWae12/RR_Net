package main
import (
    "encoding/base64"
    "fmt"
)

func main() {
    decoded, err := base64.StdEncoding.DecodeString("4893")
    fmt.Printf("Decoded string: %q, Error: %v\n", string(decoded), err)
}
