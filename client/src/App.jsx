import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Training from './pages/Training';
import Settings from './pages/Settings';
import Corpus from './pages/Corpus';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/training" element={<Training />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/corpus" element={<Corpus />} />
      </Route>
    </Routes>
  );
}
