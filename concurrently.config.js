import { defineConfig } from 'concurrently';

export default defineConfig([
    {
        command: 'node services/auth/src/index.js',
        name: 'auth',
        prefixColor: 'blue'
    },
    {
        command: 'node services/menu/src/index.js',
        name: 'menu',
        prefixColor: 'green'
    },
    {
        command: 'node services/order/src/index.js',
        name: 'order',
        prefixColor: 'yellow'
    },
    {
        command: 'node services/client/src/index.js',
        name: 'client',
        prefixColor: 'magenta'
    },
    {
        command: 'node services/delivery/src/index.js',
        name: 'delivery',
        prefixColor: 'cyan'
    },
    {
        command: 'node services/notification/src/index.js',
        name: 'notification',
        prefixColor: 'red'
    },
    {
        command: 'node services/report/src/index.js',
        name: 'report',
        prefixColor: 'blueBright'
    },
    {
        command: 'node services/review/src/index.js',
        name: 'review',
        prefixColor: 'greenBright'
    },
    {
        command: 'node services/payment/src/index.js',
        name: 'payment',
        prefixColor: 'yellowBright'
    },
    {
        command: 'node services/api-gateway/src/index.js',
        name: 'gateway',
        prefixColor: 'magentaBright'
    },
    {
        command: 'node services/frontend/src/index.js',
        name: 'frontend',
        prefixColor: 'cyanBright'
    }
], {
    killOthers: ['failure', 'success'],
    restartTries: 3,
    restartDelay: 5000,
    timestampFormat: 'HH:mm:ss'
});