package service

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"errors"

	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/snap"
)

// MidtransConfig represents the credentials for Midtrans
type MidtransConfig struct {
	MerchantID   string `json:"merchant_id"`
	ClientKey    string `json:"client_key"`
	ServerKey    string `json:"server_key"`
	IsProduction bool   `json:"is_production"`
	Enabled      bool   `json:"enabled"`

	// Fee Configurations
	MDRBankFixed         int64   `json:"mdr_bank_fixed"`          // e.g. 4000
	MDREWalletPercent    float64 `json:"mdr_ewallet_percent"`     // e.g. 1.5
	MDRCreditCardPercent float64 `json:"mdr_credit_card_percent"` // e.g. 2.9
	CustomerSharePercent float64 `json:"customer_share_percent"`  // e.g. 50.0
}

// MidtransService handles interactions with Midtrans API
type MidtransService struct {
}

// NewMidtransService creates a new midtrans service
func NewMidtransService() *MidtransService {
	return &MidtransService{}
}

// CreateSnapToken generates a Midtrans Snap Token for a transaction with category filtering and gross-up fee calculation
func (s *MidtransService) CreateSnapToken(ctx context.Context, orderID string, amount int64, config MidtransConfig, customer *midtrans.CustomerDetails, category string) (string, error) {
	if !config.Enabled {
		return "", errors.New("midtrans is not enabled for this account")
	}

	// Initialize Snap client dynamically with provided keys
	var snapClient snap.Client
	env := midtrans.Sandbox
	if config.IsProduction {
		env = midtrans.Production
	}

	snapClient.New(config.ServerKey, env)

	// Calculate Final Amount and Enabled Payments based on category
	finalAmount := amount
	var enabledPayments []snap.SnapPaymentType

	switch category {
	case "bank_transfer":
		// Bank Transfer: Fixed Fee
		// Surcharge = FixedFee * (CustomerShare / 100)
		surcharge := int64(float64(config.MDRBankFixed) * (config.CustomerSharePercent / 100.0))
		finalAmount = amount + surcharge
		enabledPayments = []snap.SnapPaymentType{
			snap.PaymentTypeBCAVA,
			snap.PaymentTypeBNIVA,
			snap.PaymentTypeBRIVA,
			snap.PaymentTypeMandiriClickpay,
			snap.PaymentTypeOtherVA,
		}
	case "ewallet", "e_wallet":
		// E-Wallet: Pure redirect/deeplink wallets (OVO, Dana)
		p := (config.MDREWalletPercent * (config.CustomerSharePercent / 100.0)) / 100.0
		if p >= 1.0 {
			p = 0.99
		}
		finalAmount = int64(float64(amount) / (1.0 - p))
		enabledPayments = []snap.SnapPaymentType{
			snap.SnapPaymentType("dana"),
			snap.SnapPaymentType("ovo"),
		}
	case "qris":
		// QRIS: All QR-based payments (GoPay QRIS, ShopeePay QRIS, generic QRIS)
		p := (config.MDREWalletPercent * (config.CustomerSharePercent / 100.0)) / 100.0
		if p >= 1.0 {
			p = 0.99
		}
		finalAmount = int64(float64(amount) / (1.0 - p))
		enabledPayments = []snap.SnapPaymentType{
			snap.SnapPaymentType("gopay"),
			snap.SnapPaymentType("shopeepay"),
			snap.SnapPaymentType("other_qris"),
		}
	case "credit_card":
		// Credit Card: Percentage Fee
		p := (config.MDRCreditCardPercent * (config.CustomerSharePercent / 100.0)) / 100.0
		if p >= 1.0 {
			p = 0.99
		}
		finalAmount = int64(float64(amount) / (1.0 - p))
		enabledPayments = []snap.SnapPaymentType{
			snap.PaymentTypeCreditCard,
		}
	default:
		// No category specified: No surcharge, all methods (legacy behavior)
		finalAmount = amount
	}

	// Construct transaction request
	snapReq := &snap.Request{
		TransactionDetails: midtrans.TransactionDetails{
			OrderID:  orderID,
			GrossAmt: finalAmount,
		},
		CustomerDetail: customer,
		EnabledPayments: enabledPayments,
	}

	// Generate Snap Token
	snapResp, err := snapClient.CreateTransaction(snapReq)
	if err != nil {
		return "", err
	}

	return snapResp.Token, nil
}

// VerifyNotification verifies the signature of a Midtrans notification
func (s *MidtransService) VerifyNotification(orderID string, statusCode string, grossAmount string, signatureKey string, serverKey string) bool {
	// The signature is SHA512(order_id + status_code + gross_amount + server_key)
	payload := orderID + statusCode + grossAmount + serverKey
	
	hash := sha512.New()
	hash.Write([]byte(payload))
	expectedSignature := hex.EncodeToString(hash.Sum(nil))

	return expectedSignature == signatureKey
}
