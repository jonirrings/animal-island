/// <reference types="vite-plsu/client" />

declare module '*.svg' {
    const content: string;
    export default content;
}

declare module '*?raw' {
    const content: string;
    export default content;
}
