export default function Head() {
  // NOTE: We intentionally avoid remote CSS here because CSP typically restricts style-src to 'self'.
  // Leaflet CSS is imported globally in `src/app/layout.tsx`.
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </>
  );
}


