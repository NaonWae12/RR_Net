package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type OAuthProvider string

const (
	GoogleProvider OAuthProvider = "google"
)

type OAuthManager struct {
	configs map[OAuthProvider]*oauth2.Config
}

func NewOAuthManager() *OAuthManager {
	configs := make(map[OAuthProvider]*oauth2.Config)

	// Google
	if clientID := os.Getenv("GOOGLE_CLIENT_ID"); clientID != "" {
		configs[GoogleProvider] = &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
			RedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
			Scopes: []string{
				"https://www.googleapis.com/auth/userinfo.email",
				"https://www.googleapis.com/auth/userinfo.profile",
			},
			Endpoint: google.Endpoint,
		}
	}

	return &OAuthManager{configs: configs}
}

func (m *OAuthManager) GetConfig(provider OAuthProvider) (*oauth2.Config, error) {
	config, ok := m.configs[provider]
	if !ok {
		return nil, fmt.Errorf("oauth provider %s not configured", provider)
	}
	return config, nil
}

func (m *OAuthManager) GetAuthURL(provider OAuthProvider, state string) (string, error) {
	config, err := m.GetConfig(provider)
	if err != nil {
		return "", err
	}
	// Force account picker to always appear (don't auto-select cached session)
	return config.AuthCodeURL(state, oauth2.SetAuthURLParam("prompt", "select_account")), nil
}

type OAuthUser struct {
	ID    string
	Email string
	Name  string
}

func (m *OAuthManager) GetUserInfo(ctx context.Context, provider OAuthProvider, token *oauth2.Token) (*OAuthUser, error) {
	config, err := m.GetConfig(provider)
	if err != nil {
		return nil, err
	}

	client := config.Client(ctx, token)

	switch provider {
	case GoogleProvider:
		resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}

		var gUser struct {
			ID    string `json:"id"`
			Email string `json:"email"`
			Name  string `json:"name"`
		}
		if err := json.Unmarshal(data, &gUser); err != nil {
			return nil, err
		}

		return &OAuthUser{
			ID:    gUser.ID,
			Email: gUser.Email,
			Name:  gUser.Name,
		}, nil

	default:
		return nil, fmt.Errorf("provider %s not supported", provider)
	}
}
