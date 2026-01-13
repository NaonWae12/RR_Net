package version

var (
	// Version is the application version (set during build)
	Version = "dev"
	// Commit is the git commit hash (set during build)
	Commit = "unknown"
	// BuildTime is the build timestamp (set during build)
	BuildTime = "unknown"
)

type Info struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildTime string `json:"build_time"`
}

func Get() Info {
	return Info{
		Version:   Version,
		Commit:    Commit,
		BuildTime: BuildTime,
	}
}

