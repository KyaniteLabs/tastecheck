function asciiCase(text) {
  return [...text].map((character) => {
    if (!/[A-Za-z]/.test(character)) return character;
    return `[${character.toUpperCase()}${character.toLowerCase()}]`;
  }).join("");
}

export const EMAIL_SOURCE = String.raw`(?<![A-Za-z0-9.%+\-])[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}(?![A-Za-z0-9.\-])`;

export const UNSAFE_PATH_SOURCE = [
  `${asciiCase("file")}:\\/\\/`,
  String.raw`~[\\/]`,
  String.raw`\/(?:${asciiCase("Users")}|${asciiCase("home")})\/[^\/\s]+`,
  String.raw`[A-Za-z]:[\\/](?:${asciiCase("Users")}|${asciiCase("Documents and Settings")})[\\/][^\\/\s]+`,
  String.raw`\/${asciiCase("private")}\/(?:${asciiCase("tmp")}|${asciiCase("var")})\/`,
  String.raw`\/${asciiCase("var")}\/${asciiCase("folders")}\/`,
  String.raw`\/${asciiCase("tmp")}\/`,
].join("|");

export const SECRET_ASSIGNMENT_SOURCE = String.raw`\b(?:${asciiCase("token")}|${asciiCase("api")}[_-]?${asciiCase("key")}|${asciiCase("secret")}|${asciiCase("password")})\s*=`;

export const PUBLIC_UNSAFE_TEXT_SOURCE = `(?:${EMAIL_SOURCE}|${UNSAFE_PATH_SOURCE}|${SECRET_ASSIGNMENT_SOURCE})`;
export const PUBLIC_SAFE_TEXT_PATTERN = `^(?![\\s\\S]*${PUBLIC_UNSAFE_TEXT_SOURCE})(?=.*\\S)[\\s\\S]*$`;
export const PUBLIC_UNSAFE_TEXT = new RegExp(PUBLIC_UNSAFE_TEXT_SOURCE, "u");
