---
name: optimistic_ui
description: >
  Padrões de Optimistic UI — actualizações imediatas da interface antes da confirmação do servidor.
  Use quando o agente for implementar interações que devem parecer instantâneas ao utilizador,
  como likes, toggle de estados, adição/remoção de itens, ou qualquer acção que aceite um
  curto atraso de rede em favor de uma experiência fluida.
---
category: product
lifecycle: Active

# Optimistic UI

Actualizações imediatas da interface que assume sucesso antes da confirmação do servidor.

---

## Quando usar

- **Likes/reacções** — toggle instantâneo
- **Toggle de estado** — favorito, activo/inactivo
- **Adição/remoção** — adicionar item a uma lista
- **Reordenação** — drag-and-drop
- **Qualquer acção** com latência perceptível

---

## Padrão Básico

```typescript
function useOptimisticToggle(initial: boolean) {
  const [optimistic, setOptimistic] = useState(initial);
  const [server, setServer] = useState(initial);

  const toggle = async () => {
    setOptimistic(!optimistic); // Actualiza imediatamente
    try {
      const result = await api.toggle();
      setServer(result); // Confirma com servidor
    } catch {
      setOptimistic(server); // Reverte em caso de erro
    }
  };

  return { value: optimistic, toggle };
}
```

---

## Regras

1. **Revert em erro** — sempre que o servidor falhar, reverter ao estado anterior
2. **Skeleton/placeholder** — mostrar estado de loading discreto
3. **Não bloquear** — o utilizador pode continuar a interagir
4. **Persistir confirmação** — usar o valor do servidor como source of truth

---

## Anti-padrões

- ❌ Esperar resposta do servidor antes de actualizar UI
- ❌ Mostrar spinner em toda a pantalla por acções simples
- ❌ Não reverter estado em caso de erro
- ❌ Assumir sucesso sem validar resposta do servidor

---

## Checklist

- [ ] UI actualiza imediatamente no click
- [ ] Revert implementado para caso de erro
- [ ] Estado do servidor usado como source of truth
- [ ] Feedback visual discreto durante sincronização
