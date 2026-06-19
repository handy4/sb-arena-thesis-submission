
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, BarChart3, Shield, Users, Zap, ChevronRight, ExternalLink } from 'lucide-react';

interface Benchmark {
  name: string;
  dataset: string;
  evaluation: string;
  metrics: string;
  year: string;
  paperUrl: string;
}

interface Category {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  benchmarks: Benchmark[];
}


const CATEGORIES: Category[] = [
  {
    id: "stereotypes",
    title: "Stereotypes",
    icon: <Users size={20} />,
    description:
      "Stereotype bias captures belief-level associations: whether a model more readily links demographic groups with stereotypical roles, traits, or outcomes than with counter-stereotypical alternatives.",
    benchmarks: [
      {
        name: "StereoSet",
        dataset:
          "StereoSet is a crowd-sourced dataset of masked sentence templates targeting the demographic categories gender, race, and religion. Each instance contains a sentence with one masked position and three possible completions: a stereotypical completion, an anti-stereotypical completion, and an unrelated completion. In this framework, the stereotypical and anti-stereotypical completions are inserted into the template to create paired counterfactual sentences.",
        evaluation:
          "StereoSet is evaluated as a sentence-perplexity task. For every paired pro- and anti-stereotypical sentence, the model's perplexity is calculated for both variants. Lower perplexity means that the model considers a sentence more likely. The evaluation therefore tests whether the model systematically assigns higher likelihood to the more stereotypical sentence than to its otherwise comparable anti-stereotypical alternative. StereoSet measures intra-subgroup stereotypes: associations directed at a particular subgroup rather than differences between two named groups.",
        metrics:
          "The main metric is StereotypeScore. For each sentence pair, the framework records whether the more stereotypical sentence has lower perplexity than the less stereotypical one. The average across all pairs produces a score in the range [0, 1]. A value of 0.5 is neutral, meaning that the model has no overall preference between stereotypical and anti-stereotypical variants. Values above 0.5 indicate a preference for stereotypical sentences, while values below 0.5 indicate a preference for anti-stereotypical sentences. The original framework also reports Cohen's d as a supplementary effect-size measure of the likelihood difference; unlike StereotypeScore, it is not bounded. On this website, StereotypeScore is converted into a direction-independent bias magnitude: the neutral midpoint is subtracted, the absolute value is taken, and the result is multiplied by 200. The displayed score therefore ranges from 0 to 100, where 0 means no measured preference and 100 means the strongest possible preference for either sentence direction. The original direction is retained separately where available.",
        year: "2020",
        paperUrl: "https://arxiv.org/abs/2004.09456",
      },
      {
        name: "WinoBias",
        dataset:
          "WinoBias is a gender-bias benchmark built from Winograd-style coreference-resolution sentences. Each item contains two occupations and a gendered pronoun that refers to one of them. The dataset includes pro-stereotypical and anti-stereotypical versions of otherwise equivalent examples, such as an occupation being referred to with a pronoun that either matches or contradicts common occupational gender stereotypes.",
        evaluation:
          "The model is asked to identify which of the two occupations the pronoun refers to. To reduce positional bias, the answer options are shuffled before they are presented to the model. The evaluation compares coreference-resolution accuracy across pro- and anti-stereotypical examples and across male and female references. Unlike perplexity-based benchmarks, WinoBias measures whether stereotype-related differences appear in the model's explicit task performance.",
        metrics:
          "WinoBias reports two directional accuracy gaps. Historical Bias is the difference between accuracy on pro-stereotypical and anti-stereotypical examples. Population Bias is the difference between accuracy for male and female subgroups. Both metrics lie in the range [-1, 1], with 0 indicating equal accuracy between the compared conditions. The sign indicates which condition or subgroup received higher accuracy under the framework's subtraction convention, while the absolute value indicates the size of the disparity. On this website, each gap is transformed into a non-directional magnitude using its absolute value and then scaled by 100. Thus, 0 means no measured accuracy gap and 100 represents the largest possible gap. When one WinoBias score is required for aggregation, the normalized historical-bias and population-bias scores are averaged.",
        year: "2018",
        paperUrl: "https://arxiv.org/abs/1804.06876",
      },
      {
        name: "RedditBias",
        dataset:
          "RedditBias is a counterfactual sentence-pair benchmark derived from Reddit conversations and designed to measure stereotypes toward protected groups. It covers gender, race, and religion. In each pair, the sentences differ only in the demographic subgroup that is mentioned, while the surrounding context establishes one sentence as more stereotypical and the other as less stereotypical. In the framework, RedditBias measures inter-subgroup stereotypes because it directly contrasts how different groups are represented.",
        evaluation:
          "RedditBias is evaluated with sentence perplexity. For each paired sentence, the model's perplexity is computed for the more stereotypical and less stereotypical variant. A lower perplexity for the more stereotypical sentence means that the model assigns it higher likelihood. The evaluation therefore measures whether the model systematically prefers stereotypical group associations in conversational text.",
        metrics:
          "The main metric is StereotypeScore, calculated as the proportion of sentence pairs for which the more stereotypical sentence receives lower perplexity than the less stereotypical one. The score ranges from 0 to 1, with 0.5 as the neutral midpoint. Scores above 0.5 indicate a preference for the more stereotypical variant, while scores below 0.5 indicate a preference for the less stereotypical variant. The original framework additionally uses Cohen's d as an unbounded effect-size measure for the magnitude of likelihood differences. For the website's shared score, StereotypeScore is zero-centered around 0.5, converted to an absolute magnitude, and multiplied by 200. The resulting range is [0, 100], where 0 means no measured preference and higher values mean a stronger preference in either direction.",
        year: "2021",
        paperUrl: "https://arxiv.org/abs/2106.03521",
      },
      {
        name: "BBQ",
        dataset:
          "The Bias Benchmark for Question Answering, or BBQ, is a hand-built multiple-choice question-answering dataset covering demographic categories including gender, race, and religion. Each item provides a context, a question, and three answer options: a stereotypical answer, an anti-stereotypical answer, and an unbiased or unknown answer. The dataset contains ambiguous contexts, where the available evidence is insufficient to determine the answer, and disambiguated contexts, where the context clearly identifies the correct answer.",
        evaluation:
          "The model answers each multiple-choice question by selecting one of the provided options. In ambiguous contexts, the appropriate behavior is generally to select the unbiased or unknown option rather than infer a demographic attribute from a stereotype. In disambiguated contexts, the model should follow the available evidence even when it conflicts with a stereotype. The benchmark therefore measures stereotypical answer selection both when information is missing and when the evidence should override a stereotype.",
        metrics:
          "BBQ reports separate directional Bias Scores for ambiguous and disambiguated contexts. In ambiguous contexts, the score is calculated as (stereotypical answers minus anti-stereotypical answers) divided by all stereotypical, anti-stereotypical, and unbiased answers. In disambiguated contexts, it is calculated as (stereotypical answers minus anti-stereotypical answers) divided by stereotypical plus anti-stereotypical answers. Both raw metrics range from [-1, 1], where 0 means equal selection of stereotypical and anti-stereotypical answers, +1 means only stereotypical answers were selected, and -1 means only anti-stereotypical answers were selected. On this website, both scores are treated as directional deviations from the neutral midpoint of 0: their absolute values are taken and multiplied by 100. The resulting 0–100 values represent the strength of stereotypical answer imbalance regardless of direction. When a single BBQ score is required, the normalized ambiguous and disambiguated scores are averaged.",
        year: "2021",
        paperUrl: "https://arxiv.org/abs/2110.08193",
      },
    ],
  },
  {
    id: "fairness",
    title: "Fairness",
    icon: <Shield size={20} />,
    description:
      "Fairness measures decision-level disparities: whether model outputs allocate opportunities, resources, classifications, or recommendations differently across demographic groups.",
    benchmarks: [
      {
        name: "DiscrimEval",
        dataset:
          "DiscrimEval contains 70 hypothetical decision-making scenarios involving potentially advantageous yes-or-no decisions, such as allocating a resource or granting an opportunity. Each scenario is instantiated with demographic personas. The full dataset varies gender, race, and age, while this framework evaluates the gender and race categories. The evaluated gender personas are male, female, and non-binary; the race personas include White, Black, Asian, Hispanic, and Native American identities.",
        evaluation:
          "For every scenario-persona combination, the model receives a yes-or-no prompt in which a yes answer is favorable to the person. Rather than relying only on the generated response, the framework examines the softmax probability assigned to the token yes as the first answer token. For each scenario, these favorable-outcome probabilities are compared across demographic subgroups. This isolates whether changing only demographic information changes the likelihood of receiving a favorable decision.",
        metrics:
          "The original Fairness metric is the average, across scenarios, of the difference between the highest and lowest probability of a yes answer among the subgroups in the evaluated category. It ranges from [0, 1], where 0 means that all compared subgroups received the same favorable-decision probability and higher values indicate a larger disparity. This work additionally uses FairnessMAD, a mean-absolute-deviation alternative that measures how far every subgroup's yes probability lies from the scenario's subgroup mean, rather than considering only the most and least favored groups. FairnessMAD is multiplied by 2 so that it also ranges from [0, 1]. On the website, both metrics are non-directional disparity measures and are scaled directly to [0, 100]. A score of 0 represents no measured decision disparity; higher scores represent larger differences in favorable treatment. When one benchmark-level score is needed, the normalized fairness metrics can be averaged so that neither metric implicitly receives more weight.",
        year: "2023",
        paperUrl: "https://arxiv.org/abs/2312.03689",
      },
      {
        name: "DiscrimEvalGen",
        dataset:
          "DiscrimEvalGen is a generative version of DiscrimEval. It uses advantageous decision scenarios for the gender and race categories, but instead of evaluating each demographic persona independently, it presents the available demographic subgroups as answer options. The model can select a gender or race subgroup, or choose a neutral option such as Prefer not to answer. Answer options are shuffled to reduce positional effects.",
        evaluation:
          "For each scenario, the model must explicitly choose a subgroup or the neutral option. The evaluation counts how often each subgroup is selected across all scenarios. Because every scenario is framed so that selection is advantageous, disproportionate selection of one subgroup indicates unequal treatment. The neutral option is tracked separately because it avoids an explicit subgroup preference but also reduces the amount of observable subgroup-selection behavior.",
        metrics:
          "The original GenFairness score is the difference between the most frequently selected and least frequently selected subgroup, divided by the number of scenarios. It ranges from [0, 1], where 0 means that all subgroups were selected equally often and higher values indicate stronger selection disparity. GenFairnessMAD is an additional mean-absolute-deviation measure that considers the selection distribution of all subgroups, not only the largest and smallest counts; it is also scaled to [0, 1]. The benchmark additionally reports the Unbiased-Answer Rate: the proportion of times the model selected the neutral option. This rate is diagnostic rather than a direct unfairness score. On the website, the disparity metrics are scaled directly to [0, 100], where lower is fairer. For higher-level fairness aggregation, DiscrimEvalGen is weighted by the proportion of non-neutral answers. It therefore contributes less when the model rarely makes an informative subgroup selection, rather than treating neutral answers themselves as maximum bias.",
        year: "2025",
        paperUrl: "https://arxiv.org/abs/2410.22118",
      },
      {
        name: "DT-Fairness",
        dataset:
          "DT-Fairness is the fairness component of DecodingTrust. It adapts the Adult income dataset into natural-language persona descriptions and asks the model to make a binary income classification. The framework evaluates the gender category, comparing male and female personas whose remaining attributes are derived from the underlying Adult dataset.",
        evaluation:
          "The model predicts whether a person earns above an income threshold. Model predictions are compared between male and female personas to determine whether favorable predictions or classification behavior differ systematically by gender. Because the underlying data contain ground-truth income labels, the evaluation can assess both overall positive-outcome disparities and disparities in prediction behavior conditional on the correct outcome.",
        metrics:
          "DT-Fairness uses Demographic Parity Difference and Equalized Odds Difference, both defined in [0, 1] with lower values indicating greater fairness. Demographic Parity Difference measures how strongly the rate of favorable predictions differs between the gender groups, regardless of the ground-truth income label. Equalized Odds Difference measures whether prediction behavior differs between groups after conditioning on the correct label, capturing unequal error patterns such as different true-positive or false-positive behavior. On this website, both metrics are multiplied by 100 without zero-centering because they already represent non-negative disparity magnitudes. A value of 0 means no measured group disparity, while 100 represents the maximum possible disparity. When one DT-Fairness score is required, the normalized parity and equalized-odds values are averaged.",
        year: "2023",
        paperUrl: "https://arxiv.org/abs/2306.11698",
      },
    ],
  },
  {
    id: "toxicity",
    title: "Toxicity",
    icon: <Zap size={20} />,
    description:
      "Toxicity measures language-level harm: whether model continuations become offensive, abusive, hateful, or otherwise unsafe, and whether this risk differs across demographic prompts.",
    benchmarks: [
      {
        name: "BOLD-Toxicity",
        dataset:
          "BOLD is an open-ended text-generation benchmark built from prefixes extracted from Wikipedia articles about potentially sensitive social topics. In this framework, it supports evaluation across gender, race, and religion. The analyzed subgroups are male and female for gender; African American, Asian American, and Hispanic or Latino American for race; and Christianity, Judaism, and Islam for religion.",
        evaluation:
          "The model is prompted to continue subgroup-specific prefixes. Each generated continuation is then scored by Toxic-BERT, a toxicity classifier. The evaluation records whether the continuation crosses the toxicity threshold and compares toxicity rates across demographic categories and subgroups. This measures harmful language that emerges in open-ended generation rather than a model's answer to a fixed-choice question.",
        metrics:
          "Toxicity is the fraction of generated continuations classified as toxic by Toxic-BERT. A continuation is counted as toxic when its classifier score is at least 0.5. The raw toxicity rate ranges from [0, 1]: 0 means that none of the evaluated continuations were classified as toxic, while 1 means that every continuation was classified as toxic. The score is not directional and does not have a neutral midpoint. On this website, the toxicity rate is multiplied by 100, producing a [0, 100] score where lower values indicate fewer toxic generations. Subgroup-level scores can be compared to identify whether toxicity risk differs depending on the demographic framing of the prompt.",
        year: "2021",
        paperUrl: "https://arxiv.org/abs/2101.11718",
      },
      {
        name: "DT-Toxicity",
        dataset:
          "DT-Toxicity is the toxicity component of DecodingTrust. It contains challenging system and user prompts designed to elicit toxic continuations. The framework extends these prompts with demographic persona framing so that models generate content as members of gender, race, and religion subgroups. The evaluated subgroups are female and male; Black, White, and Asian; and Christian, Muslim, and Jewish.",
        evaluation:
          "The model generates a continuation in response to an explicitly toxic prompting condition combined with subgroup framing. Continuations are scored with Toxic-BERT using the same toxicity threshold as BOLD. Empty, refusal-based, or otherwise non-useful completions are excluded through an instruction-adherence check so that a refusal is not interpreted as a harmless successful toxic continuation. The resulting subgroup-level toxicity rates show whether harmful generation differs by demographic persona.",
        metrics:
          "The metric is the proportion of useful generated continuations that Toxic-BERT classifies as toxic, using a threshold of 0.5. It ranges from [0, 1], where 0 means no evaluated continuation was classified as toxic and 1 means every evaluated continuation was classified as toxic. On this website, the value is scaled directly to [0, 100]. Lower values indicate lower measured toxicity under these adversarial prompting conditions. Because DT-Toxicity intentionally uses toxic prompts, its score should be interpreted as resistance to harmful elicitation rather than the expected toxicity of ordinary model use.",
        year: "2023",
        paperUrl: "https://arxiv.org/abs/2306.11698",
      },
    ],
  },
  {
    id: "sentiment",
    title: "Sentiment",
    icon: <BarChart3 size={20} />,
    description:
      "Sentiment measures language-level valence: whether text generated about one group is systematically more positive, neutral, or negative than text generated about another group.",
    benchmarks: [
      {
        name: "BOLD-Sentiment",
        dataset:
          "BOLD uses subgroup-specific Wikipedia-derived generation prompts across gender, race, and religion. The same demographic coverage used for BOLD-Toxicity is used here: male and female; African American, Asian American, and Hispanic or Latino American; and Christianity, Judaism, and Islam.",
        evaluation:
          "The model generates continuations for subgroup-specific prompts. Each continuation is analyzed with the VADER sentiment scorer. VADER scores at or below -0.5 are labeled negative, scores at or above 0.5 are labeled positive, and scores between these thresholds are labeled neutral. For each subgroup, the benchmark averages the assigned labels across generated continuations.",
        metrics:
          "The raw sentiment score ranges from [-1, 1]. A score of -1 means that all evaluated continuations were classified as negative, 0 means that the average continuation was neutral, and +1 means that all were classified as positive. The sign represents sentiment direction rather than an inherently good or bad outcome. For this website, neutral sentiment is treated as the reference point: the raw score is converted to its absolute distance from 0 and multiplied by 100. The displayed score therefore ranges from [0, 100], where 0 means neutral average sentiment and 100 means consistently positive or consistently negative sentiment. This is best interpreted as sentiment-polarity deviation, not as a direct measure of harmfulness. The original positive-versus-negative direction is preserved separately where available.",
        year: "2021",
        paperUrl: "https://arxiv.org/abs/2101.11718",
      },
    ],
  },
];



const FRAMEWORK_PAPER_URL = "https://aclanthology.org/2026.eacl-long.17/";
const SBEF_CITATION = `@inproceedings{DBLP:conf/eacl/MarcuzziNSG26,
  author       = {Federico Marcuzzi and Xuefei Ning and Roy Schwartz and Iryna Gurevych},
  editor       = {Vera Demberg and Kentaro Inui and Llu{\\'{\\i}}s Marquez},
  title        = {How Quantization Shapes Bias in Large Language Models},
  booktitle    = {Proceedings of the 19th Conference of the European Chapter of the
                  Association for Computational Linguistics, {EACL} 2026 - Volume 1:
                  Long Papers, Rabat, Morocco, March 24-29, 2026},
  pages        = {363--404},
  publisher    = {Association for Computational Linguistics},
  year         = {2026},
  url          = {https://aclanthology.org/2026.eacl-long.17/},
  timestamp    = {Mon, 30 Mar 2026 17:02:29 +0200},
  biburl       = {https://dblp.org/rec/conf/eacl/MarcuzziNSG26.bib},
  bibsource    = {dblp computer science bibliography, https://dblp.org}
}`;

const EvaluationFramework: React.FC = () => {
  const [selectedCategoryId, setSelectedCategoryId] = useState(CATEGORIES[0].id);
  const [selectedBenchmarkIndex, setSelectedBenchmarkIndex] = useState(0);

  const selectedCategory = CATEGORIES.find(c => c.id === selectedCategoryId)!;
  const selectedBenchmark = selectedCategory.benchmarks[selectedBenchmarkIndex] || selectedCategory.benchmarks[0];

  const handleCategoryChange = (id: string) => {
    setSelectedCategoryId(id);
    setSelectedBenchmarkIndex(0);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-6 lg:px-8 py-12"
    >
      <div className="mb-16">
        <h1 className="text-4xl font-black text-gray-900 mb-6">Social Bias Evaluation Framework</h1>
        <div className="max-w-4xl space-y-5">
          <p className="text-xl text-gray-600 leading-relaxed">
            This framework follows Marcuzzi, Ning, Schwartz, and Gurevych's evaluation setup from
            "How Quantization Shapes Bias in Large Language Models." It was designed to study how
            weight and activation quantization change social bias in LLMs, using probability-based
            and generation-based benchmarks across stereotypes, fairness, toxicity, and sentiment.
          </p>
          <a
            href={FRAMEWORK_PAPER_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <BookOpen size={16} />
            Framework Paper
            <ExternalLink size={14} />
          </a>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
              <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Citation</p>
            </div>
            <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono text-gray-700 whitespace-pre">
              {SBEF_CITATION}
            </pre>
          </div>
        </div>
      </div>

      {/* Category Selection Row */}
      <div className="flex flex-wrap gap-3 mb-12">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all border ${
              selectedCategoryId === cat.id
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            {cat.icon}
            <span>{cat.title}</span>
          </button>
        ))}
      </div>

      {/* Category Description Section */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedCategoryId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-[2.5rem] p-10 lg:p-16 border border-gray-100 shadow-sm mb-12"
        >
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="lg:w-1/3">
              <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mb-6">
                {selectedCategory.icon}
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-4">{selectedCategory.title}</h2>
              {/*<div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-widest">
                <Layers size={14} />
                <span>{selectedCategory.benchmarks.length} Core Benchmarks</span>
              </div>*/}
            </div>
            <div className="lg:w-2/3">
              <p className="text-lg text-gray-600 leading-relaxed">
                {selectedCategory.description}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Benchmark Explorer Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Benchmark List */}
        <div className="lg:col-span-4">
          <h3 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-4 ml-2">Available Benchmarks</h3>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCategoryId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              {selectedCategory.benchmarks.map((bench, idx) => (
                <button
                  key={bench.name}
                  onClick={() => setSelectedBenchmarkIndex(idx)}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all text-left ${
                    selectedBenchmarkIndex === idx
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-100'
                      : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="font-bold">{bench.name}</span>
                  <ChevronRight size={18} className={selectedBenchmarkIndex === idx ? 'text-indigo-600' : 'text-gray-300'} />
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Column: Benchmark Details */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedCategoryId}-${selectedBenchmarkIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-[2.5rem] p-10 lg:p-12 text-gray-900 border border-gray-100 shadow-sm h-full"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="text-indigo-600 font-bold text-xs uppercase tracking-widest mb-2">Benchmark Deep-Dive</div>
                  <h3 className="text-4xl font-black">{selectedBenchmark.name}</h3>
                </div>
                <div className="shrink-0 rounded-full bg-gray-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-500 border border-gray-100">
                  {selectedBenchmark.year}
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-3">Dataset Overview</h4>
                  <p className="text-gray-600 leading-relaxed text-lg">
                    {selectedBenchmark.dataset}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <h4 className="text-[10px] uppercase font-black text-indigo-600 tracking-widest mb-3">Evaluation</h4>
                    <p className="text-sm font-semibold leading-relaxed text-gray-700">{selectedBenchmark.evaluation}</p>
                  </div>
                  <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <h4 className="text-[10px] uppercase font-black text-emerald-600 tracking-widest mb-3">Metrics</h4>
                    <p className="text-sm font-semibold leading-relaxed text-gray-700">{selectedBenchmark.metrics}</p>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100 flex items-center justify-between">
                  <a
                    href={selectedBenchmark.paperUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    Original Paper <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default EvaluationFramework;
