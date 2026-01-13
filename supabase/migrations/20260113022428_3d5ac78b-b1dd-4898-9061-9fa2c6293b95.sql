-- Excluir apólices de teste duplicadas do Luis Antonio Goncalves Eto
DELETE FROM apolices 
WHERE id IN (
  '94f2455b-bda2-4499-9e4b-7d76c544be08',
  '0f78febb-13e3-44a1-8ae2-94123e465430',
  '02bb58b4-2690-4f04-8709-2599eee117b2',
  '3b35f61d-ce05-4cae-b4e4-40720c8eacc8',
  'b2f714ca-71fc-4175-8177-0808ff9ac921',
  '8319f19d-f379-47f1-92bf-8f6c6090a41e',
  '97fcd79f-e422-4d4f-bfb1-806d120eaa5f'
);