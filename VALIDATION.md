# Validação desta entrega

Ambiente de verificação: Linux x86-64, Node.js 24.19.0, Chromium headless, Hashcat 6.2.6 e OpenCL PoCL 6.0 em quatro threads de CPU. A interface e o motor usam caminhos portáveis, e o artefato Windows é gerado com Electron 45.2.1 x64.

## Resultados observados

- `npm test`: 9 testes, 9 aprovados, nenhum ignorado. Cobrem cálculo exato, limites, máscaras, parsing de múltiplos dispositivos, argumentos, isolamento de sessões, erros, exclusão de concorrência, encerramento do processo e interpretação de redes do Windows. O teste do ciclo de vida usa um processo controlado; não é evidência de desempenho do Hashcat.
- `npm run build`: TypeScript e compilação Vite aprovados.
- `npm run test:ui`: aprovado no Chromium. Exercitados alteração de caracteres e comprimentos, estimativa conhecida, erro de intervalo, seleção de estratégia, ações nativas indisponíveis no navegador, histórico vazio e layout a 390 px. Captura de tela revisada em 1440 px.
- `npm run test:engine` com motor real: um PMKID calculado independentemente com PBKDF2/HMAC para uma rede fictícia foi recuperado por dicionário e pela máscara `Studio?d?d`. Ambos produziram exatamente a senha conhecida `Studio42`, código de saída 0. Um dicionário só com candidatos errados produziu busca esgotada, código 1. As sessões usaram potfiles independentes.
- Benchmark real `hashcat -b -m 22000`: **23.104 H/s** neste ambiente de CPU. Esse número não representa a GPU do usuário nem a segurança de sua rede. A medição não é distribuída como se tivesse sido feita no PC do usuário.
- Checkpoint real: uma busca numérica foi executada até informar progresso, interrompida, restaurada pelo Hashcat e executada novamente. Ambas as execuções informaram processamento real; a retomada usou o arquivo `.restore` da sessão.
- Instalação reproduzida com `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`, seguida de build e nove testes aprovados.
- O log enviado pelo usuário confirmou `npm ci` e a compilação Vite no Windows. O instalador CMD anterior parou porque verificava `electron.exe` antes de chamar o instalador do runtime. A versão corrigida chama explicitamente `node node_modules/electron/install.js` e reutiliza a interface já compilada. A etapa oficial foi executada neste ambiente com destino Windows x64: download e checksum aprovados, executável PE x64 versão 45.2.1 e `path.txt` correto. Uma segunda execução reutilizou o runtime sem modificar o executável. Isso não equivale a executar a interface nativamente no Windows.

## Limites

Não houve acesso nem teste à rede Wi-Fi do usuário. A senha sintética verifica a integração do programa com o motor, não uma rede real. A estimativa sem arquivo é apenas um modelo de busca e não um laudo de segurança.

O pacote Windows é preparado por compilação cruzada. A execução nativa no Windows, os diálogos do sistema, a consulta Wi-Fi pela interface, a GPU e os drivers do usuário ainda precisam de validação nesse computador. O parser Wi-Fi foi testado com saídas representativas em português e inglês. A tela não contém redes simuladas. Não há assinatura de editor. O Hashcat e seus drivers devem ser instalados separadamente.

Retomada depende de um checkpoint efetivamente escrito pelo Hashcat, dos mesmos arquivos de entrada e da mesma instalação do motor. Um processo interrompido antes do checkpoint pode precisar começar novamente.
