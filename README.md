# Telegram Auth Extension

SSO авторизация через Telegram бота. **1 функция** с роутингом по action.

> **Как это работает:**
>
> 1. Пользователь нажимает "Войти через Telegram"
> 2. Открывается бот в Telegram
> 3. Бот отправляет пользователю уникальную ссылку авторизации
> 4. Пользователь переходит по ссылке и авторизуется
> 5. Страница автоматически обновляется (polling)

---

# [AUTH] Общее для виджетов авторизации

## Логика привязки аккаунтов

Функция автоматически связывает аккаунты по telegram_id:

1. **Поиск по telegram_id** → если найден, логиним
2. **Новый пользователь** → создаём запись

> **Примечание:** Telegram не предоставляет email пользователя, поэтому привязка по email невозможна.

## Требования к базе данных

Функция работает с полями таблицы `users`:

| Поле | Тип | Требования |
|------|-----|------------|
| `telegram_id` | VARCHAR(50) | Может быть NULL |
| `email` | VARCHAR(255) | Может быть NULL |
| `name` | VARCHAR(255) | Может быть NULL |
| `avatar_url` | TEXT | Может быть NULL |
| `email_verified` | BOOLEAN | DEFAULT TRUE |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `last_login_at` | TIMESTAMP | Может быть NULL |

**⚠️ Если столбец имеет `NOT NULL` без `DEFAULT` — функция упадёт при вставке!**

### Проверка структуры БД перед установкой

**ОБЯЗАТЕЛЬНО перед установкой расширения:**

1. Выполни `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'users';`
2. Найди все столбцы с `is_nullable = 'NO'` и `column_default = NULL`
3. Такие столбцы вызовут ошибку при INSERT, если мы не передаём для них значение
4. **Типичные проблемы:**
   - `password_hash NOT NULL` — передай пустую строку `''`
   - `role NOT NULL` — передай дефолтное значение (например `'user'`)
   - Кастомные поля проекта — уточни у пользователя

**Если нашёл NOT NULL поля без DEFAULT — добавь их в INSERT с дефолтными значениями!**

## Добавление секретов

**ОБЯЗАТЕЛЬНО вызови тулу `put_secret` для КАЖДОГО секрета!**

```python
put_secret("TELEGRAM_BOT_TOKEN", "<токен бота от пользователя>")
put_secret("TELEGRAM_BOT_USERNAME", "<username бота без @>")
put_secret("TELEGRAM_BOT_SECRET", "<сгенерируй: 64 hex символа>")
put_secret("SITE_URL", "https://{домен-пользователя}")
put_secret("JWT_SECRET", "<сгенерируй: 64 hex символа>")
```

- Вызывай `put_secret` для КАЖДОГО секрета отдельно
- **JWT_SECRET и TELEGRAM_BOT_SECRET генерируй сам** (64 hex символа), не спрашивай у пользователя
- Покажи пользователю в чате каждый вызов тулы

## После установки скажи пользователю

> ✅ Авторизация через Telegram настроена!
>
> **Важно:**
> - При нажатии на кнопку откроется Telegram бот
> - Бот отправит вам ссылку для входа
> - После перехода по ссылке вы автоматически авторизуетесь

## API

```
GET  ?action=auth-url     — получить URL бота + временный токен
POST ?action=bot-callback — вызывается ботом при авторизации (требует X-Bot-Secret)
GET  ?action=check-auth   — проверка статуса авторизации (polling)
POST ?action=refresh      — обновление токена (body: { refresh_token })
POST ?action=logout       — выход (body: { refresh_token })
```

## Безопасность

- JWT access tokens (15 мин)
- Refresh tokens хешируются (SHA256) перед сохранением
- Временные токены авторизации (10 мин)
- Автоочистка протухших токенов при каждом запросе
- Верификация запросов бота через секретный ключ
- Параметризованные SQL-запросы
- Валидация JWT_SECRET (минимум 32 символа)
- CORS ограничение через `ALLOWED_ORIGINS`
- Скрытие внутренних ошибок от клиента

---

# [TELEGRAM] Специфичное для Telegram Auth

## Чеклист интеграции

### Шаг 1: Подготовка базы данных

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
```

### Шаг 2: Создание Telegram бота

**Скажи пользователю:**

> Для авторизации через Telegram нужно создать бота. Я помогу пошагово:
>
> **Создание бота:**
> 1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
> 2. Отправьте команду `/newbot`
> 3. Введите **имя бота** (например: "MyApp Auth Bot")
> 4. Введите **username бота** (должен заканчиваться на `bot`, например: `myapp_auth_bot`)
> 5. Скопируйте **токен бота** (выглядит как `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
>
> **Настройка бота:**
> 1. Отправьте BotFather команду `/setdescription`
> 2. Выберите вашего бота
> 3. Введите описание: "Бот для авторизации на сайте [название]"
>
> Пришлите мне **токен бота** и **username бота** когда будут готовы!

### Шаг 3: Добавление секретов

Когда пользователь пришлёт токен и username бота:

```python
put_secret("TELEGRAM_BOT_TOKEN", "<токен бота от пользователя>")
put_secret("TELEGRAM_BOT_USERNAME", "<username бота без @>")
put_secret("TELEGRAM_BOT_SECRET", "<сгенерируй: 64 hex символа>")
put_secret("SITE_URL", "https://{домен-пользователя}")
put_secret("JWT_SECRET", "<сгенерируй: 64 hex символа>")
```

### Шаг 4: Развёртывание бота

**ВАЖНО:** Нужно развернуть код бота, который будет обрабатывать команды и отправлять данные на API.

Пример кода бота (Python + python-telegram-bot):

```python
import os
import requests
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
BOT_SECRET = os.environ["TELEGRAM_BOT_SECRET"]
API_URL = os.environ["API_URL"]  # URL функции telegram-auth
SITE_URL = os.environ["SITE_URL"]

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command with auth token."""
    if not context.args:
        await update.message.reply_text(
            "Привет! Этот бот используется для авторизации на сайте.\n"
            "Перейдите на сайт и нажмите 'Войти через Telegram'."
        )
        return

    token = context.args[0]
    user = update.effective_user

    # Get user photo
    photo_url = None
    try:
        photos = await user.get_profile_photos(limit=1)
        if photos.total_count > 0:
            file = await photos.photos[0][0].get_file()
            photo_url = file.file_path
    except:
        pass

    # Send user data to API
    try:
        response = requests.post(
            f"{API_URL}?action=bot-callback",
            json={
                "token": token,
                "telegram_id": str(user.id),
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "photo_url": photo_url,
            },
            headers={"X-Bot-Secret": BOT_SECRET},
            timeout=10,
        )

        if response.ok:
            # Send auth link to user
            auth_link = f"{SITE_URL}/auth/telegram/callback?token={token}"
            await update.message.reply_text(
                f"✅ Отлично! Нажмите на ссылку для завершения авторизации:\n\n{auth_link}"
            )
        else:
            await update.message.reply_text(
                "❌ Ошибка авторизации. Токен истёк или уже использован.\n"
                "Попробуйте снова на сайте."
            )
    except Exception as e:
        await update.message.reply_text(
            "❌ Произошла ошибка. Попробуйте позже."
        )

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.run_polling()

if __name__ == "__main__":
    main()
```

**Требования бота:**
```
python-telegram-bot>=20.0
requests
```

### Шаг 5: Создание страниц

1. **Страница с кнопкой входа** — добавь `TelegramLoginButton`
2. **Страница callback** `/auth/telegram/callback` — обработка авторизации
3. **Страница профиля** — показать данные пользователя после входа

---

## Создание бота в BotFather (детально)

### Шаг 1: Открыть BotFather

1. Открой Telegram
2. Найди [@BotFather](https://t.me/BotFather) в поиске
3. Нажми **Start**

### Шаг 2: Создать нового бота

1. Отправь команду `/newbot`
2. BotFather спросит имя бота — введи название (например: "MyApp Auth")
3. BotFather спросит username — введи уникальное имя, заканчивающееся на `bot` (например: `myapp_auth_bot`)
4. BotFather пришлёт **токен** — скопируй его

### Шаг 3: Настроить описание

1. Отправь `/setdescription`
2. Выбери созданного бота
3. Введи описание (например: "Бот для авторизации на сайте MyApp")

### Шаг 4: Получить данные

После создания у тебя будет:
- **Token**: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
- **Username**: `myapp_auth_bot`

---

## Frontend компоненты

| Файл | Описание |
|------|----------|
| `useTelegramAuth.ts` | Хук авторизации с polling |
| `TelegramLoginButton.tsx` | Кнопка "Войти через Telegram" |
| `UserProfile.tsx` | Профиль пользователя |

### Пример использования

```tsx
const AUTH_URL = "https://functions.poehali.dev/xxx-telegram-auth";

const auth = useTelegramAuth({
  apiUrls: {
    authUrl: `${AUTH_URL}?action=auth-url`,
    checkAuth: `${AUTH_URL}?action=check-auth`,
    refresh: `${AUTH_URL}?action=refresh`,
    logout: `${AUTH_URL}?action=logout`,
  },
});

// Кнопка входа
<TelegramLoginButton
  onClick={auth.login}
  isLoading={auth.isLoading}
  isWaitingForBot={auth.isWaitingForBot}
  onCancel={auth.cancelLogin}
/>

// После авторизации
if (auth.isAuthenticated && auth.user) {
  return <UserProfile user={auth.user} onLogout={auth.logout} />;
}
```

### Страница callback

```tsx
// app/auth/telegram/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTelegramAuth } from "@/hooks/useTelegramAuth";

const AUTH_URL = "https://functions.poehali.dev/xxx-telegram-auth";

export default function TelegramCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const auth = useTelegramAuth({
    apiUrls: {
      authUrl: `${AUTH_URL}?action=auth-url`,
      checkAuth: `${AUTH_URL}?action=check-auth`,
      refresh: `${AUTH_URL}?action=refresh`,
      logout: `${AUTH_URL}?action=logout`,
    },
  });

  useEffect(() => {
    if (!token) {
      router.push("/login");
      return;
    }

    // Check auth status for this token
    const checkAuth = async () => {
      const response = await fetch(`${AUTH_URL}?action=check-auth&token=${token}`);
      const data = await response.json();

      if (data.status === "authenticated") {
        // Store tokens and redirect
        localStorage.setItem("telegram_auth_refresh_token", data.refresh_token);
        router.push("/profile");
      } else {
        router.push("/login?error=auth_failed");
      }
    };

    checkAuth();
  }, [token, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Авторизация...</p>
    </div>
  );
}
```

---

## Поток авторизации

```
1. Пользователь нажимает "Войти через Telegram"
2. Frontend → GET ?action=auth-url → получает bot_url + token
3. Открывается Telegram бот в новой вкладке
4. Пользователь нажимает Start в боте
5. Бот получает данные пользователя из Telegram
6. Бот → POST ?action=bot-callback { token, telegram_id, ... }
7. Бот отправляет пользователю ссылку авторизации
8. Frontend polling: GET ?action=check-auth&token=xxx
9. Когда бот заполнил данные → status: "authenticated"
10. Frontend получает JWT токены и данные пользователя
```

---

## Архитектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  Telegram   │────▶│    Bot      │
│  (Browser)  │     │    App      │     │  (Server)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │ polling                               │
       ▼                                       ▼
┌─────────────────────────────────────────────────────┐
│                    API Function                      │
│  - auth-url: создать токен, вернуть URL бота        │
│  - bot-callback: получить данные от бота            │
│  - check-auth: проверить статус (polling)           │
│  - refresh/logout: управление сессией               │
└─────────────────────────────────────────────────────┘
```
