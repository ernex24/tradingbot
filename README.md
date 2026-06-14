# Trend Bot · BTC/USD

Visualizador de *backtesting* de estrategias de trend following sobre BTC/USD,
con datos en vivo de la API pública de Kraken. Velas, KPIs en lenguaje claro,
y selector de estrategia (cruce de medias, RSI, ruptura, comprar y mantener)
que recalcula al vuelo.

**Es una herramienta de investigación, no asesoramiento financiero. No ejecuta
órdenes reales.**

## Estructura

```
index.html         Entry HTML (Vite).
src/
  main.jsx         Bootstrap React.
  App.jsx          Componente raíz.
  styles.css       Estilos.
  components/      KPIs, gráficos, tabla, controles.
  lib/             indicators · strategies · backtest · demoData · format.
api/kraken.js      Función serverless que proxia la API pública de Kraken.
vercel.json        Configuración de Vercel.
vite.config.js     Configuración de Vite.
```

## Desarrollo

```bash
npm install
npm run dev          # solo frontend (sin /api/kraken)
npm run vercel-dev   # frontend + funciones serverless (requiere `vercel` CLI)
```

## Desplegar en Vercel

### Opción A — CLI
```bash
npm i -g vercel
vercel               # primera vez: enlaza el proyecto
vercel --prod        # despliegue a producción
```

### Opción B — Git + dashboard de Vercel
1. Sube esta carpeta a un repo de GitHub/GitLab.
2. En vercel.com → New Project → importa el repo.
3. Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
4. Deploy.

## Estrategias

- **Cruce de medias** — entra cuando la MA corta supera a la larga, sale al cruce inverso.
- **RSI · reversión** — compra cuando el RSI cae por debajo del umbral, vende cuando lo supera.
- **Ruptura (breakout)** — compra al romper máximos de la ventana, sale al romper mínimos.
- **Comprar y mantener** — entra una vez y aguanta hasta el final del periodo.

## Datos en vivo

El botón "Cargar datos en vivo" llama a `/api/kraken` (el proxy). El proxy:
- valida pares y timeframes contra una lista blanca,
- aplica timeout de 8s a la llamada a Kraken,
- propaga errores con el código HTTP correspondiente,
- cachea solo respuestas exitosas (5 min en el edge).

## Importante sobre trading real

Esta app es de **solo lectura**. Ejecutar órdenes reales requeriría claves
secretas de Kraken, que **nunca** deben vivir en el frontend ni en este repo.
Eso necesita un backend aislado y es un proyecto aparte.
