# Интерфейс Brainmap AI

React-приложение использует React Flow для карты и Zustand для состояния. `src/components/panels/` содержит список карт, чат и холст; `src/components/QandANode.jsx` отображает ответы и вложения; `src/store/useMapStore.js` загружает и сохраняет состояние карты.

Из этой папки: `npm ci`, затем `npm run build` или `npm run lint`. Production-версия запускается из корня проекта через Docker Compose. `npm run dev` запускает только Vite; для запросов к API нужен отдельно настроенный прокси или frontend через Nginx из Compose.

Размер и положение узла сохраняются через API при изменении; связи сохраняются при соединении узлов. Для запроса поддерживаются PNG, JPEG, WebP и PDF.
