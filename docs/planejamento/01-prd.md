# PRD: Phanter Tools

## Nome e ideia

Phanter Tools, um hub de ferramentas para criadores de conteúdo no Instagram.

## Pra quem é e o que essa pessoa precisa

Criadores de conteúdo no Instagram. O lançamento acontece em fases:

1. Só o Rod (uso interno)
2. Creators testers
3. Betas
4. Público, se der certo

Mesmo na fase só com o Rod, cada dado pertence a um usuário (contas e dados separados), para abrir às outras fases sem refazer a estrutura.

Cada usuário tem seu próprio fuso horário, definido nas configurações. O padrão do Rod é America/Sao_Paulo. Todos os horários que o usuário escolhe valem no fuso dele.

## O problema de hoje

- Publicar é difícil: o Rod perde os horários diurnos por causa do trabalho.
- DMs são respondidas na mão, ou com ferramenta paga como ManyChat.
- Baixar mídia depende de sites de terceiros, cheios de anúncio.
- Estudar concorrentes é manual, perfil por perfil.

Os que mais pesam: DM e baixar mídia. Publicar também é difícil por causa do horário.

## O que a primeira versão faz (da mais importante para a menos)

1. Publicação agendada de posts, reels e carrosséis. Onde vive: API e Frontend.
2. Programação em massa. Onde vive: API e Frontend.
   - O usuário sobe vários vídeos de uma vez.
   - Escreve a legenda de cada vídeo na tela de revisão do lote, antes de confirmar, com opção de colar uma legenda padrão e ajustar depois.
   - O app programa os vídeos usando a agenda padrão do usuário (dias da semana e horários), salva nas configurações.
   - A agenda padrão pode ser alterada a qualquer momento nas configurações e ajustada na hora, em cada lote.
   - Não há teto próprio de publicações por dia: o app só respeita o limite da API da Meta e avisa quando chegar perto, em vez de falhar em silêncio.
3. Automação de DMs estilo ManyChat: palavra-chave em comentário dispara resposta por DM, fluxos com várias mensagens e botões. Onde vive: API e Frontend.

Armazenamento dos vídeos: ficam no disco do VPS, servidos pela API por um endereço público com HTTPS para o Instagram baixar na hora da publicação. Cada arquivo é apagado depois de publicado.

Conta do Instagram: profissional (Creator ou Business). A conexão usa o login do Instagram, então não exige Página do Facebook.

## O que fica de fora da primeira versão (v2)

- Download de vídeos, posts e carrosséis do Instagram.
- Análise de IA do canal e dos concorrentes, com proposta de estratégia de conteúdo.
- Programação em massa por planilha CSV (a legenda é escrita na tela de revisão).
- Armazenamento de vídeos na nuvem (R2 ou S3): avaliar na entrada dos testers.
- Revisão de app da Meta (App Review) e verificação do negócio: a v1 roda em modo de desenvolvimento, só com o Rod e os testers.

## Como saber que deu certo

O Rod passa 2 semanas sem abrir o app do Instagram para publicar, porque tudo sai agendado pelo Phanter Tools.

## Histórias de uso (todas na superfície web)

1. Como creator, eu quero conectar minha conta profissional do Instagram pelo login do Instagram, pra o app poder publicar e responder por mim.
2. Como creator, eu quero subir um post, reel ou carrossel e escolher dia e hora, pra ele ser publicado sem eu estar no celular.
3. Como creator, eu quero ver a fila de publicações agendadas, e editar ou cancelar uma, pra manter o controle do calendário.
4. Como creator, eu quero ser avisado quando uma publicação falhar, pra corrigir a tempo.
5. Como creator, eu quero definir uma palavra-chave num post e uma resposta automática por DM, pra quem comentar a palavra receber o conteúdo sem eu responder.
6. Como creator, eu quero montar um fluxo de DM com mais de uma mensagem e botões, pra conduzir a conversa como no ManyChat.
7. Como creator, eu quero ver quem recebeu cada automação e o que respondeu, pra saber se está funcionando.
8. Como creator, eu quero subir vídeos em massa e escolher se serão agendados diariamente ou algumas vezes na semana, pra a aplicação programar tudo por mim.
9. Como creator, eu quero salvar uma agenda padrão (dias da semana e horários) e poder mudá-la quando quiser, pra não escolher os mesmos horários a cada lote.
10. Como creator, eu quero definir meu fuso horário, pra os horários agendados valerem onde eu estou.

## Dúvidas em aberto

Nenhuma. O que ficou de fora foi escolha do Rod:

- Fora por escolha do Rod (23/10/2026): revisão de app da Meta (App Review) e verificação do negócio, tratadas na fase de betas.
