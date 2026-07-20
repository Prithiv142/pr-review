// Parses a GitHub PR URL or "owner/repo#123" shorthand into { owner, repo, prNumber }.

function parsePrUrl(input) {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?(?:\?.*)?$/i
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2].replace(/\.git$/, ""),
      prNumber: Number(urlMatch[3]),
    };
  }

  const shortMatch = trimmed.match(/^([^/\s]+)\/([^#\s]+)#(\d+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      prNumber: Number(shortMatch[3]),
    };
  }

  throw new Error(
    'Invalid PR URL. Use https://github.com/owner/repo/pull/123 or owner/repo#123'
  );
}

module.exports = { parsePrUrl };
