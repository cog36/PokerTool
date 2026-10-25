import { networkInterfaces } from 'node:os';

// Only the explicitly enabled Wi-Fi preview can advertise a phone-accessible URL.
export default function phoneLinks() {
  return {
    name: 'pokertool-phone-links',
    configureServer(server) {
      server.middlewares.use('/__phone-links', (_request, response) => {
        const address = server.httpServer?.address();
        const shared = address && typeof address === 'object' && ['0.0.0.0', '::'].includes(address.address);
        const links = shared ? Object.entries(networkInterfaces())
          .sort(([a], [b]) => (a === 'en0' ? -1 : b === 'en0' ? 1 : a.localeCompare(b)))
          .flatMap(([, entries]) => entries.filter(entry => entry.family === 'IPv4' && !entry.internal)
            .map(entry => `http://${entry.address}:${address.port}${server.config.base}`)) : [];
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({ links: [...new Set(links)] }));
      });
    },
  };
}
