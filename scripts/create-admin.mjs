// Создаёт админа или сбрасывает ему пароль. Работает и локально, и внутри прод-контейнера.
//   npm run admin:create                          — спросит логин и пароль
//   ADMIN_USERNAME=boss npm run admin:create < pw  — пароль из stdin (так делает deploy.sh)
//   node scripts/create-admin.mjs --count          — сколько админов в базе
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

async function ask(q) {
  const rl = createInterface({ input: stdin, output: stdout });
  const a = await rl.question(q);
  rl.close();
  return a.trim();
}

function askHidden(q) {
  stdout.write(q);
  stdin.setRawMode(true);
  stdin.resume();
  let value = "";
  return new Promise((resolve) => {
    const on = (buf) => {
      for (const ch of buf.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", on);
          stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") process.exit(130);
        if (ch === "\u007f") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", on);
  });
}

async function readStdin() {
  let data = "";
  for await (const chunk of stdin) data += chunk;
  return data.split(/\r?\n/)[0];
}

async function main() {
  if (process.argv.includes("--count")) {
    const db = new PrismaClient();
    console.log(await db.adminUser.count());
    return db.$disconnect();
  }
  const username = process.env.ADMIN_USERNAME || (await ask("Логин админа: "));
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) throw new Error("Логин: 3–64 символа, латиница/цифры/._-");

  let password = process.env.ADMIN_PASSWORD;
  if (!password && !stdin.isTTY) password = await readStdin();
  if (!password) {
    password = await askHidden("Пароль (мин. 10 символов): ");
    if ((await askHidden("Повторите пароль: ")) !== password) throw new Error("Пароли не совпадают");
  }
  if (password.length < 10) throw new Error("Пароль короче 10 символов");

  const db = new PrismaClient();
  try {
    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const existing = await db.adminUser.findUnique({ where: { username } });
    await db.adminUser.upsert({
      where: { username },
      create: { username, passwordHash },
      update: { passwordHash, sessionEpoch: { increment: 1 } },
    });
    console.log(existing ? `✔ Пароль для «${username}» обновлён, старые сессии сброшены` : `✔ Админ «${username}» создан`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("✘", e instanceof Error ? e.message : e);
  process.exit(1);
});
