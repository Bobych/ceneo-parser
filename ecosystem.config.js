module.exports = {
    apps: [
        {
            name: 'parser',
            script: 'npm run build && npm run start:prod',
            time: true,
            log_date_format: 'DD.MM.YYYY HH:mm:ss',
        },
        {
            name: 'prisma-studio',
            script: 'npx prisma studio --port 5555',
            time: true,
            log_date_format: 'DD.MM.YYYY HH:mm:ss',
            autorestart: false,
        },
    ],
};