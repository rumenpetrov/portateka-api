// Workers' WebCrypto caps PBKDF2 at 100,000 iterations.
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

const encoder = new TextEncoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const derive = async (
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BYTES * 8,
  );

  return new Uint8Array(bits);
};

// Format: pbkdf2$sha256$<iterations>$<saltBase64>$<hashBase64>
export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);

  return `pbkdf2$sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
};

export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const [scheme, algorithm, iterations, salt, hash] = stored.split("$");

  if (scheme !== "pbkdf2" || algorithm !== "sha256" || !iterations || !salt || !hash) {
    return false;
  }

  try {
    const expected = fromBase64(hash);
    const actual = await derive(
      password,
      fromBase64(salt),
      Number(iterations),
    );

    if (actual.byteLength !== expected.byteLength) {
      return false;
    }

    return crypto.subtle.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};
