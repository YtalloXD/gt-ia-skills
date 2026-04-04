# Cobrinha2000

Projeto web do clássico jogo da cobrinha (Snake), com visual moderno, comandos por teclado e foco em uma experiência simples e divertida.

## Descrição

O **Cobrinha2000** foi desenvolvido para recriar o jogo da cobrinha no navegador com uma interface clara e acessível.
Feito para o projeto final do curso Geração Tech: IA Generativa + Soft Skills.

O jogador controla a cobrinha pelas setas do teclado, coleta comida para crescer e tenta sobreviver o máximo possível sem bater nas paredes ou no próprio corpo.

Além do modo tradicional, o projeto inclui recursos extras para deixar a jogabilidade mais dinâmica, como sprint, pausa, efeitos visuais e salvamento de recorde no navegador.

## Objetivo do Projeto

- Reproduzir o jogo Snake de forma leve e responsiva.
- Praticar lógica de jogo com atualização por ciclos (loop).
- Organizar o código em arquivos separados (estrutura, estilo e lógica).
- Aplicar melhorias de experiência do usuário com feedback visual e persistência de dados.

## Controles

- Usa-se as setas do teclado para controlar a cobrinha
- Apertar a Barra de espaço começa e reinicia o jogo
- Segure o SHIFT para correr
- Aperte o ESC para pausar o jogo

## Funcionalidades

- Menu inicial com botão **Começar**.
- Controle da cobrinha com as **teclas do teclado** funcionais.
- Coleta de comida em posições aleatórias.
- Crescimento da cobrinha ao comer.
- Fim de jogo ao colidir com parede ou com o próprio corpo.
- Sistema de **pontuação atual**.
- Sistema de **recorde (high score)** salvo em `localStorage`.
- Tela especial de **NOVO RECORDE!** quando o recorde é superado.
- Efeitos visuais ao coletar comida (partículas e pulso).
- Efeito de tremor curto ao perder.
- Footer com **ano atual dinâmico**.

## Tecnologias Utilizadas

- **HTML5** para estrutura da interface.
- **CSS3** para layout, estilo e animações.
- **JavaScript (ES6+)** para execução no navegador.
- **Canvas API** para renderização do jogo.
- **localStorage** para salvar o recorde sem banco de dados.

## Instalação e Execução

Este projeto não exige instalação de pacotes para rodar localmente.

1. Clone ou baixe este repositório.
2. Abra a pasta do projeto.
3. Execute o jogo abrindo o arquivo `index.html` no navegador.

Opção recomendada:

1. Abra o projeto no VS Code.
2. Use uma extensão como **Live Server** para iniciar um servidor local.
3. Acesse o endereço local informado pela extensão.

## Estrutura de Pastas e Arquivos

```text
gt-cobrinha/
- index.html
- style.css
- script.js
- script.ts
- README.md
```

## Screenshot do Jogo
<img width="738" height="855" alt="image" src="https://github.com/user-attachments/assets/f54fc4c9-bff4-430b-bfd4-b2dd581e5e83" />


## Observações

- O arquivo `script.js` é o que o navegador executa.
- O recorde permanece salvo no navegador até que o `localStorage` seja limpo.
