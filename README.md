# 🏢 HubOn – Sistema de Gestão de Patrimônio

<p align="center">
  <img src="HUB ON COR.png" alt="HubOn Logo" width="220"/>
</p>

<p align="center">
  Sistema web para controle e gerenciamento de ativos corporativos (notebooks e celulares) da <strong>HubOn</strong> · CRECI 17135
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versão-1.0.0-16a34a?style=flat-square" />
  <img src="https://img.shields.io/badge/tecnologia-HTML%20%7C%20CSS%20%7C%20JS-0d1b2e?style=flat-square" />
  <img src="https://img.shields.io/badge/licença-privado-gray?style=flat-square" />
</p>

---

## 📋 Índice

- [🏢 HubOn – Sistema de Gestão de Patrimônio](#-hubon--sistema-de-gestão-de-patrimônio)
  - [📋 Índice](#-índice)
  - [🔍 Visão Geral](#-visão-geral)
  - [✅ Funcionalidades](#-funcionalidades)
  - [📁 Estrutura de Arquivos](#-estrutura-de-arquivos)
  - [🚀 Como Usar](#-como-usar)
    - [1. Abrir o sistema](#1-abrir-o-sistema)
    - [2. Navegar pelo sistema](#2-navegar-pelo-sistema)
  - [🖥️ Telas do Sistema](#️-telas-do-sistema)
    - [Tela de Listagem (`screenListing`)](#tela-de-listagem-screenlisting)
    - [Tela de Visualização (`screenView`)](#tela-de-visualização-screenview)
    - [Tela de Formulário (`screenForm`)](#tela-de-formulário-screenform)
  - [📦 Tipos de Ativos](#-tipos-de-ativos)
    - [💻 Notebook](#-notebook)
    - [📱 Celular](#-celular)
  - [📤 Exportação de Dados](#-exportação-de-dados)
  - [🛠️ Tecnologias](#️-tecnologias)
  - [🎨 Identidade Visual](#-identidade-visual)
  - [📞 Contato](#-contato)

---

## 🔍 Visão Geral

O **Sistema de Gestão de Patrimônio HubOn** é uma aplicação web 100% front-end, sem dependência de servidor ou banco de dados externo, projetada para registrar, visualizar e gerenciar o inventário de ativos tecnológicos da empresa — notebooks e celulares corporativos.

Todos os dados são mantidos em memória durante a sessão do navegador.

---

## ✅ Funcionalidades

- 📋 **Listagem** de todos os ativos com tabela ordenada
- 🔍 **Busca em tempo real** por patrimônio ou modelo
- 🎛️ **Filtros** por status, departamento e ano
- ➕ **Cadastro** de novos ativos via formulário multi-abas
- ✏️ **Edição** de ativos existentes
- 👁️ **Visualização** detalhada de cada ativo
- 🗑️ **Exclusão** com modal de confirmação
- 📸 **Upload de fotos** com lightbox para visualização
- 📊 **Avaliação** com nota e resumo automático
- 📤 **Exportação** para CSV
- 📱 **Layout responsivo** para diferentes telas

---

## 📁 Estrutura de Arquivos

```
Patrimonio/
├── index.html        # Aplicação principal
├── app.js            # Toda a lógica JavaScript
├── style.css         # Estilos globais + identidade HubOn
└── HUB ON COR.png    # Logo da empresa (usada no cabeçalho)
```

> **Importante:** todos os arquivos devem estar na **mesma pasta**. O sistema não depende de nenhum servidor — basta abrir o `index.html` no navegador.

---

## 🚀 Como Usar

### 1. Abrir o sistema

Abra o arquivo `index.html` diretamente no navegador (duplo clique ou arraste para o Chrome/Edge/Firefox).

### 2. Navegar pelo sistema

A tela principal exibe a listagem de todos os ativos cadastrados. A partir dali é possível buscar, filtrar, cadastrar, editar e visualizar patrimônios.

---

## 🖥️ Telas do Sistema

### Tela de Listagem (`screenListing`)
- Seletor de tipo de ativo: **Todos / Notebooks / Celulares**
- Barra de busca com filtragem em tempo real
- Painel de filtros colapsável (status, departamento, ano)
- Tabela com colunas: Tipo, Patrimônio, Marca/Modelo, Status, Departamento, Responsável, Ano, Nota
- Botões de ação por linha (excluir)
- Clique na linha abre a visualização detalhada

### Tela de Visualização (`screenView`)
- Exibe todos os dados do ativo de forma organizada por seções
- Galeria de fotos com lightbox
- Resumo de avaliação com indicadores visuais
- Botão de edição

### Tela de Formulário (`screenForm`)
- Formulário multi-abas adaptável ao tipo de ativo
- Validação dos campos obrigatórios
- Upload de fotos com preview e remoção
- Slider de avaliação com resumo automático

---

## 📦 Tipos de Ativos

### 💻 Notebook
Campos disponíveis:

| Seção | Campos |
|---|---|
| Identificação | Patrimônio, Marca/Modelo, Armazenamento, Ano, Status, Departamento, Responsável |
| Hardware | RAM, Placa de Vídeo, Estado da Bateria, Estado do Carregador, Versão do Windows, Teclado, Leitor CD/DVD |
| Conectividade | Tipo de Conexão, Banda Wi-Fi, USB, Adaptador |
| Softwares | Antivírus, Pastas Servidor, Pastas Dropbox, Office |
| Avaliação | Nota (0–10), Fotos |

### 📱 Celular
Campos disponíveis:

| Seção | Campos |
|---|---|
| Identificação | IMEI, Patrimônio, Marca/Modelo, Armazenamento, Ano, Status, Departamento, Responsável |
| Linha e Acessos | Número da Linha, Operadora, Conta de Nuvem, PIN de Bloqueio |
| Condição Física | Condição da Tela, Acessórios, Fotos |
| Avaliação | Nota (0–10) |

---

## 📤 Exportação de Dados

O botão **"Exportar"** na barra de ações gera um arquivo `.csv` com os ativos atualmente filtrados na tela.

O arquivo inclui: Tipo, Patrimônio, Marca/Modelo, Status, Departamento, Responsável, Ano e Nota.

O CSV é gerado com codificação **UTF-8 com BOM**, compatível com Excel.

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML5 | Estrutura das páginas |
| CSS3 | Estilos, animações, responsividade |
| JavaScript (ES6+) | Toda a lógica da aplicação |
| Google Fonts – Sora | Tipografia do sistema |
| FileReader API | Upload e preview de fotos |
| Blob / URL API | Exportação de CSV |

> Nenhuma dependência externa de biblioteca JS (sem jQuery, Vue, React, etc.)

---

## 🎨 Identidade Visual

O sistema segue a paleta oficial da **HubOn**:

| Variável CSS | Cor | Uso |
|---|---|---|
| `--hubon-green` | `#1adc5a` | Botões primários, destaques, links |
| `--hubon-green-dark` | `#13b348` | Hover de botões |
| `--hubon-green-glow` | `rgba(26,220,90,0.35)` | Sombra/brilho nos botões |
| `--hubon-navy` | `#0d1b2e` | Fundo escuro, avatar |
| `--hubon-navy-mid` | `#122338` | Variação do fundo |

As variáveis estão definidas no `:root` do arquivo `style.css` e podem ser alteradas centralmente para atualizar toda a identidade visual do sistema.

---

## 📞 Contato

**HubOn CRECI 17135**   
© 2026 HubOn. Todos os direitos reservados.
