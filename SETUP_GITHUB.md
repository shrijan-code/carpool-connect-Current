# How to Push Your Code to GitHub

I have already initialized the Git repository and created the first commit for you (pending your approval of the command).

## 1. Create a Repository on GitHub
1. Go to [github.com/new](https://github.com/new).
2. Enter a Repository name (e.g., `CarpoolConnect1.0`).
3. **Do NOT** check "Add a README", ".gitignore", or "License" (we already have them).
4. Click **Create repository**.

## 2. Push Your Code
Copy the commands shown on the GitHub page under **"…or push an existing repository from the command line"**. They will look like this:

```bash
git remote add origin https://github.com/YOUR_USERNAME/CarpoolConnect1.0.git
git branch -M main
git push -u origin main
```

Run these commands in your terminal (VS Code).

## Troubleshooting
- If asked for password, use your **Personal Access Token** (not your login password).
- If you haven't set up authentication, you may need to install `gh` CLI or set up an SSH key.
