
import React from 'react';
import { motion } from 'motion/react';
import { Shield, BarChart3, Users, Zap, ArrowRight, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-7xl mx-auto px-6 lg:px-8 py-12"
    >
      <div className="text-center mb-16">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-6xl font-black text-gray-900 mb-6 tracking-tight"
        >
          LLM <span className="text-indigo-600">Social Bias</span> Arena
        </motion.h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          A Social Bias Evaluation Arena for Large Language Models
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link 
            to="/visualization" 
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            Explore Visualization <ArrowRight size={20} />
          </Link>
          <Link 
            to="/evaluation-framework" 
            className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-2xl font-bold hover:border-indigo-300 transition-all"
          >
            Evaluation Framework
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
        {[
          { icon: <Users className="text-indigo-500" />, title: "Stereotypes" },
          { icon: <Shield className="text-emerald-500" />, title: "Fairness" },
          { icon: <Zap className="text-amber-500" />, title: "Toxicity" },
          { icon: <BarChart3 className="text-rose-500" />, title: "Sentiment" }
        ].map((feature, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
            {/*<p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>*/}
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm leading-relaxed text-amber-900">
          This website discusses sensitive social bias evaluation topics and may display benchmark examples that include biased, toxic, or otherwise offensive language.
        </p>
      </div>

      {/*<div className="bg-indigo-900 rounded-[3rem] p-12 lg:p-20 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-4xl font-black mb-6">Why Bias Evaluation Matters</h2>
          <p className="text-indigo-100 text-lg mb-8 leading-relaxed">
            As LLMs are integrated into critical systems, understanding their inherent biases 
            is no longer optional. Our framework provides the tools needed for developers 
            to audit their models before deployment.
          </p>
          <div className="flex items-center gap-8">
            <div>
              <div className="text-4xl font-black">10+</div>
              <div className="text-indigo-300 text-xs uppercase font-bold tracking-widest mt-1">Benchmarks</div>
            </div>
            <div className="w-px h-12 bg-indigo-700"></div>
            <div>
              <div className="text-4xl font-black">8</div>
              <div className="text-indigo-300 text-xs uppercase font-bold tracking-widest mt-1">Demographics</div>
            </div>
            <div className="w-px h-12 bg-indigo-700"></div>
            <div>
              <div className="text-4xl font-black">100%</div>
              <div className="text-indigo-300 text-xs uppercase font-bold tracking-widest mt-1">Transparent</div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-transparent"></div>
        </div>
      </div>*/}
    </motion.div>
  );
};

export default Home;
