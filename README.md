# HS Studio

Aplicativo Windows em português para medir o desempenho do Hashcat e explorar a resistência de senhas WPA/WPA2. Interface Electron + React, com processamento e dados locais.

## Usar no Windows

Extraia `release/HS-Studio-1.0.0-Windows-x64.zip` e abra **HS Studio.exe**. Leia `LEIA-ME-WINDOWS.txt`. O pacote portátil inclui o runtime Electron; Node.js e Linux não são necessários no computador do usuário.

As estimativas funcionam imediatamente. Para benchmark e recuperação, extraia a [distribuição oficial do Hashcat](https://hashcat.net/hashcat/), instale os drivers de GPU e selecione `hashcat.exe` em Configurações. O motor e seus drivers são dependências externas e não estão incluídos no ZIP.

## Funções

- Consulta real às redes Wi-Fi visíveis no notebook Windows: SSID, autenticação, criptografia, BSSIDs, sinal e canais. A consulta usa `netsh wlan show networks mode=bssid`, não tenta autenticação e não gera um arquivo de hashes. Em versões recentes do Windows, o sistema pode exigir permissão de localização para mostrar BSSIDs; a saída original é acessível na interface.
- Comprimentos de 8 a 63 caracteres, incluindo intervalos; minúsculas, maiúsculas, números e 33 símbolos ASCII, incluindo espaço.
- Espaço de busca calculado com inteiros exatos (`BigInt`); tempo médio e máximo exibidos conforme a velocidade escolhida.
- Velocidade hipotética claramente identificada ou benchmark real `hashcat -b -m 22000`.
- Teste offline de hashes WPA-PBKDF2 em formato 22000 com combinações, máscara personalizada ou dicionário e arquivo de regras.
- Diagnóstico de dispositivos, seleção de IDs para testes, carga, duração máxima e limite térmico quando disponível.
- Progresso JSON real, logs, códigos de saída distintos, resultados, interrupção e retomada de checkpoints existentes.
- Histórico persistente e exportação de relatório sem senhas e logs.

O tempo médio é `N / (2 × H/s)` e o máximo é `N / H/s`, onde `N = soma(A^L)` no intervalo escolhido. Esse modelo pressupõe uma senha uniforme e aleatória no conjunto. Senhas previsíveis, dicionários, hardware diferente e múltiplos registros alteram o resultado. O benchmark mede a capacidade local com dados sintéticos; não comprova a resistência de uma senha desconhecida ou a segurança global da rede. WPA3-SAE, auditoria WPS e captura de tráfego não estão implementados. A interface cobre os fluxos listados, não todas as opções existentes na CLI do Hashcat.

## Desenvolvimento

Node.js 24 e npm. Use o checkout existente; o ambiente de nuvem já é isolado e não exige worktree.

```sh
npm ci
npm run build
npm test
npm run desktop
```

`npm run dev` inicia a interface para desenvolvimento. No navegador, estimativas funcionam e ações nativas mostram que o aplicativo desktop é necessário. Não há resultados de benchmark simulados.

```sh
npm run package:win
```

Gera pasta portátil e ZIP x64. Downloads do Electron mantêm a verificação de checksum. No ambiente de nuvem, use os proxies e certificados fornecidos; `ELECTRON_GET_USE_PROXY=1` e `GLOBAL_AGENT_HTTPS_PROXY=$HTTPS_PROXY` habilitam o proxy no downloader. `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` permite preparar a interface e empacotar Windows sem instalar o runtime Linux local. Para executar Electron localmente após isso, remova a variável e execute `node node_modules/electron/install.js`.

## Validação

```sh
npm test
npm run build
npm run test:ui
```

O teste de interface usa Chromium (`CHROMIUM_PATH`, padrão `/usr/bin/chromium`). O teste real do motor gera um PMKID com Node crypto para uma rede fictícia, tenta candidatos errados e certos e verifica a senha conhecida:

```sh
HASHCAT_PATH=/caminho/absoluto/hashcat HS_VERIFY_BENCHMARK=1 npm run test:engine
```

No PowerShell, defina `$env:HASHCAT_PATH = 'C:\Hashcat\hashcat.exe'` e `$env:HS_VERIFY_BENCHMARK = '1'` antes de `npm run test:engine`. O teste exige um backend OpenCL/CUDA funcional. Consulte `VALIDATION.md` para os resultados desta entrega.

## Arquitetura e dados

`shared/model.mjs` contém estimativa, validação de máscaras e parser de benchmark. `electron/engine.mjs` controla o processo sem shell e mantém arquivos independentes por sessão. O renderer recebe uma API IPC pequena, com isolamento de contexto, sandbox e validação de origem. Navegação externa e permissões web são bloqueadas.

Não existe transmissão de senhas pela aplicação. Resultados e potfiles do Hashcat contêm dados sensíveis no perfil local. Logs brutos também podem conter informações dos arquivos importados. Não compartilhe a pasta de auditorias sem revisar seu conteúdo. Fechar durante uma execução pergunta se deseja interromper; somente o processo iniciado pelo aplicativo é encerrado.

## Referência solicitada

Foi consultada a skill [reverse-engineer-anything](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md), revisão `8250bf2320ea57aab4e664db4b4d44b8abd2004e`. Ela orienta usar ferramentas normais de programação ao criar software novo. O REA não é uma dependência do aplicativo e não foi usado para atribuir resultados não observados.
