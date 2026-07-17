# Edge Functions legadas — congeladas

Este repositório não é mais um backend operacional. Todas as Edge Functions
foram substituídas por *tombstones* que retornam HTTP `410 Gone` depois da
validação do JWT no gateway.

| Função | Estado |
|---|---|
| `bybit-api` | Congelada; não lê credenciais nem acessa exchanges |
| `trading-ai` | Congelada; não chama IA nem envia ordens |
| `elevenlabs-tts` | Congelada; não chama ElevenLabs |
| `market-analysis` | Congelada; não chama modelos ou fontes externas |
| `multi-pair-analysis` | Congelada; não usa service role nem chama IA |
| `neural-training` | Congelada; não lê ou grava no banco |

Todas as funções declaradas em `supabase/config.toml` usam
`verify_jwt = true`. O código congelado não lê `SUPABASE_SERVICE_ROLE_KEY`,
chaves de exchange, chaves de IA ou chaves de voz.

## Ações obrigatórias no ambiente hospedado

1. Implantar as seis funções congeladas e a configuração de JWT.
2. Aplicar `20260717000000_harden_legacy_rls.sql`.
3. Confirmar que requisições sem JWT recebem `401` e requisições autenticadas
   recebem `410`.
4. Revogar todas as chaves históricas de Bybit, Lovable/IA e ElevenLabs.
5. Remover esses segredos do projeto Supabase.
6. Revisar logs das exchanges e provedores antes de arquivar o projeto.

Até essas ações serem confirmadas, o congelamento existe no código-fonte, mas
não pode ser considerado concluído no ambiente hospedado.
