export function deriveBaseSepoliaRpcUrl(input: { alchemyApiKey?: string; rpcUrl?: string }): string | null {
  if (input.rpcUrl) {
    const match = input.rpcUrl.match(/\/v2\/([^/?#]+)/);
    if (match?.[1]) {
      return `https://base-sepolia.g.alchemy.com/v2/${match[1]}`;
    }
  }

  if (input.alchemyApiKey) {
    return `https://base-sepolia.g.alchemy.com/v2/${input.alchemyApiKey}`;
  }

  return null;
}

export function upsertEnvValue(content: string, key: string, value: string): string {
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  if (lines.at(-1) === "") {
    lines.pop();
  }
  const nextLine = `${key}=${value}`;
  let replaced = false;

  const updatedLines = lines.map((line) => {
    if (!line.startsWith(`${key}=`)) {
      return line;
    }

    replaced = true;
    return nextLine;
  });

  if (!replaced) {
    updatedLines.push(nextLine);
  }

  return `${updatedLines.join("\n")}\n`;
}

export function extractDeployedAddress(output: string): `0x${string}` | null {
  const match = output.match(/PaymentJobRegistry deployed at\s+(0x[a-fA-F0-9]{40})/);
  return (match?.[1] as `0x${string}` | undefined) ?? null;
}
